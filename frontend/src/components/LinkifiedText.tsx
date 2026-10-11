const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

/**
 * Renders message text with web links made clickable. React escapes the text, and only
 * http(s) URLs become links, so message content cannot inject markup or scripts.
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-pine-700 underline decoration-pine-300 underline-offset-2 hover:decoration-pine-600"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
