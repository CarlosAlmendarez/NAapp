export function FieldError({ messages, id }: { messages?: string[]; id?: string }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
      {messages[0]}
    </p>
  );
}
