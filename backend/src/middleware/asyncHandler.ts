import type { Request, Response, NextFunction } from "express";

export function asyncHandler<
  TReq extends Request = Request,
  TRes extends Response = Response
>(fn: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown>) {
  return (req: TReq, res: TRes, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

