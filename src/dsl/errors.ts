export class BunwrightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BunwrightError";
  }
}

export class SelectorError extends BunwrightError {
  constructor(message: string) {
    super(message);
    this.name = "SelectorError";
  }
}

export class TimeoutError extends BunwrightError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ElementNotFoundError extends BunwrightError {
  constructor(message: string) {
    super(message);
    this.name = "ElementNotFoundError";
  }
}

export class BrowserError extends BunwrightError {
  constructor(message: string) {
    super(message);
    this.name = "BrowserError";
  }
}
