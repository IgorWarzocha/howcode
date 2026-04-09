type ThreeDotsSpinnerProps = {
  className?: string;
};

export function ThreeDotsSpinner({ className }: ThreeDotsSpinnerProps) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <circle className="three-dots-spinner__dot" cx="4" cy="12" r="3" />
      <circle
        className="three-dots-spinner__dot three-dots-spinner__dot--second"
        cx="12"
        cy="12"
        r="3"
      />
      <circle
        className="three-dots-spinner__dot three-dots-spinner__dot--third"
        cx="20"
        cy="12"
        r="3"
      />
    </svg>
  );
}
