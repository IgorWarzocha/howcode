type Env = {
  DB: D1Database
  ALLOWED_ORIGINS?: string
  VOTER_HASH_SECRET?: string
}

type PollOption = {
  optionId: string
  label: string
  votes: number
}

const pollIds = new Set(['worktree-layout'])
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

function getAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('origin')
  if (!origin) return '*'
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return origin
  }
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return allowed.includes(origin) ? origin : null
}

function withCors(request: Request, env: Env, response: Response) {
  const allowedOrigin = getAllowedOrigin(request, env)
  if (!allowedOrigin) return response
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', allowedOrigin)
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS')
  headers.set('access-control-allow-headers', 'content-type')
  headers.set('vary', 'Origin')
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function json(request: Request, env: Env, body: unknown, status = 200) {
  return withCors(
    request,
    env,
    new Response(JSON.stringify(body), { headers: jsonHeaders, status }),
  )
}

function getClientAddress(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown-ip'
  )
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getVoterHash(request: Request, env: Env, pollId: string) {
  const userAgent = request.headers.get('user-agent') ?? 'unknown-ua'
  const address = getClientAddress(request)
  const secret = env.VOTER_HASH_SECRET ?? 'dev-secret-change-me'
  return sha256Hex(`${secret}:${pollId}:${address}:${userAgent}`)
}

async function getUserAgentHash(request: Request, env: Env) {
  const secret = env.VOTER_HASH_SECRET ?? 'dev-secret-change-me'
  return sha256Hex(`${secret}:${request.headers.get('user-agent') ?? 'unknown-ua'}`)
}

async function loadResults(
  env: Env,
  pollId: string,
  voterHash?: string,
): Promise<{
  pollId: string
  selectedOptionId: string | null
  totalVotes: number
  options: PollOption[]
}> {
  const options = await env.DB.prepare(
    `
      SELECT
        poll_options.option_id AS optionId,
        poll_options.label AS label,
        COUNT(poll_votes.option_id) AS votes
      FROM poll_options
      LEFT JOIN poll_votes
        ON poll_votes.poll_id = poll_options.poll_id
        AND poll_votes.option_id = poll_options.option_id
      WHERE poll_options.poll_id = ?
      GROUP BY poll_options.poll_id, poll_options.option_id
      ORDER BY poll_options.position ASC
    `,
  )
    .bind(pollId)
    .all<PollOption>()

  const selected = voterHash
    ? await env.DB.prepare(
        'SELECT option_id AS optionId FROM poll_votes WHERE poll_id = ? AND voter_hash = ?',
      )
        .bind(pollId, voterHash)
        .first<{ optionId: string }>()
    : null

  const rows = options.results ?? []
  return {
    pollId,
    selectedOptionId: selected?.optionId ?? null,
    totalVotes: rows.reduce((sum, row) => sum + Number(row.votes), 0),
    options: rows.map((row) => ({ ...row, votes: Number(row.votes) })),
  }
}

function assertPollId(pollId: unknown) {
  if (typeof pollId !== 'string' || !pollIds.has(pollId)) {
    throw new Response(JSON.stringify({ error: 'Unknown poll.' }), {
      headers: jsonHeaders,
      status: 404,
    })
  }
  return pollId
}

async function assertOption(env: Env, pollId: string, optionId: unknown) {
  if (typeof optionId !== 'string' || optionId.length > 80) {
    throw new Response(JSON.stringify({ error: 'Invalid option.' }), {
      headers: jsonHeaders,
      status: 400,
    })
  }
  const option = await env.DB.prepare(
    'SELECT option_id AS optionId FROM poll_options WHERE poll_id = ? AND option_id = ?',
  )
    .bind(pollId, optionId)
    .first<{ optionId: string }>()
  if (!option) {
    throw new Response(JSON.stringify({ error: 'Unknown option.' }), {
      headers: jsonHeaders,
      status: 404,
    })
  }
  return optionId
}

async function handleVote(request: Request, env: Env) {
  const payload = (await request.json().catch(() => null)) as {
    pollId?: unknown
    optionId?: unknown
  } | null
  const pollId = assertPollId(payload?.pollId)
  const optionId = await assertOption(env, pollId, payload?.optionId)
  const voterHash = await getVoterHash(request, env, pollId)
  const userAgentHash = await getUserAgentHash(request, env)

  const recentEvents = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM poll_vote_events WHERE voter_hash = ? AND created_at > datetime('now', '-30 seconds')",
  )
    .bind(voterHash)
    .first<{ count: number }>()
  if ((recentEvents?.count ?? 0) > 8) {
    return json(request, env, { error: 'Too many vote attempts. Try again in a minute.' }, 429)
  }

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO poll_votes (poll_id, voter_hash, option_id)
        VALUES (?, ?, ?)
        ON CONFLICT(poll_id, voter_hash)
        DO UPDATE SET option_id = excluded.option_id, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    ).bind(pollId, voterHash, optionId),
    env.DB.prepare(
      'INSERT INTO poll_vote_events (poll_id, voter_hash, option_id, user_agent_hash) VALUES (?, ?, ?, ?)',
    ).bind(pollId, voterHash, optionId, userAgentHash),
  ])

  return json(request, env, await loadResults(env, pollId, voterHash))
}

async function handleResults(request: Request, env: Env, url: URL) {
  const pollId = assertPollId(url.searchParams.get('pollId'))
  const voterHash = await getVoterHash(request, env, pollId)
  return json(request, env, await loadResults(env, pollId, voterHash))
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return withCors(request, env, new Response(null, { status: 204 }))
    }

    const allowedOrigin = getAllowedOrigin(request, env)
    if (!allowedOrigin) {
      return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
        headers: jsonHeaders,
        status: 403,
      })
    }

    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/results') {
        return handleResults(request, env, url)
      }
      if (request.method === 'POST' && url.pathname === '/vote') {
        return handleVote(request, env)
      }
      return json(request, env, { error: 'Not found.' }, 404)
    } catch (error) {
      if (error instanceof Response) return withCors(request, env, error)
      console.error(error)
      return json(request, env, { error: 'Unexpected poll error.' }, 500)
    }
  },
}
