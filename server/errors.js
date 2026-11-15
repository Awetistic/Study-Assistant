// An error the route can turn straight into a JSON response.
// `code` is a stable machine-readable string the client switches on.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
