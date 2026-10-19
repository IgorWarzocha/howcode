import type { Models } from '@earendil-works/pi-ai'

/** Captured model ports delegate each operation to their current owner. */
export function liveModels(current: () => Models): Models {
  return {
    getProviders: () => current().getProviders(),
    getProvider: (id) => current().getProvider(id),
    getModels: (provider) => current().getModels(provider),
    getModel: (provider, id) => current().getModel(provider, id),
    getModelsOfType: (type, provider) => current().getModelsOfType(type, provider),
    getModelOfType: (type, provider, id) => current().getModelOfType(type, provider, id),
    getAllModels: (provider) => current().getAllModels(provider),
    refresh: (options) => current().refresh(options),
    checkAuth: (provider, options) => current().checkAuth(provider, options),
    getAvailable: (provider, options) => current().getAvailable(provider, options),
    getAvailableOfType: (type, provider, options) =>
      current().getAvailableOfType(type, provider, options),
    getAllAvailable: (provider, options) => current().getAllAvailable(provider, options),
    getAuth: (provider, options) =>
      typeof provider === 'string'
        ? current().getAuth(provider, options)
        : current().getAuth(provider, options),
    login: (provider, type, interaction, options) =>
      current().login(provider, type, interaction, options),
    logout: (provider, options) => current().logout(provider, options),
    stream: (model, context, options) => current().stream(model, context, options),
    complete: (model, context, options) => current().complete(model, context, options),
    streamSimple: (model, context, options) => current().streamSimple(model, context, options),
    completeSimple: (model, context, options) => current().completeSimple(model, context, options),
    streamDeferred: (model, handle, options) => current().streamDeferred(model, handle, options),
    fetchDeferred: (model, handle, options) => current().fetchDeferred(model, handle, options),
    cancelDeferred: (model, handle, options) => current().cancelDeferred(model, handle, options),
    generateImages: (model, context, options) => current().generateImages(model, context, options),
    classify: (model, context, options) => current().classify(model, context, options),
  }
}
