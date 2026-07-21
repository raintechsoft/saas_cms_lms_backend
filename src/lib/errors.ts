import type { NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "APPLICATION_ERROR",
  ) {
    super(message);
  }
}

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
