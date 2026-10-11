const CREDENTIALS_IN_URI = /\/\/[^/@\s]+@/g;

export function redactCredentials(text: string): string {
  return text.replace(CREDENTIALS_IN_URI, '//***@');
}

export function describeConnectionTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return 'the configured MongoDB server';
  }
}

export function explainConnectionError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = redactCredentials(error instanceof Error ? error.message : String(error));

  if (/bad auth|authentication failed/i.test(message)) {
    return (
      'Authentication failed. Check the username and password in MONGODB_URI. ' +
      'Special characters in the password must be URL-encoded (for example @ becomes %40).'
    );
  }
  if (/not authorized/i.test(message)) {
    return (
      'Connected, but the database user has no permission on this database. ' +
      'In Atlas > Database Access, grant the user readWrite on it.'
    );
  }
  if (/querySrv|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return 'The cluster host name could not be resolved. Check the host in MONGODB_URI and your internet connection.';
  }
  if (
    /ServerSelection/i.test(name) ||
    /whitelist|could not connect to any servers/i.test(message)
  ) {
    return (
      "The cluster could not be reached. The most common cause is that this machine's IP address " +
      'is not on the Atlas > Network Access list.'
    );
  }
  return message;
}
