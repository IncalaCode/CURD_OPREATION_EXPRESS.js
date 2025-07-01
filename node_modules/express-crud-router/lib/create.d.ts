import { RequestHandler, Request, Response } from 'express';
export declare type Create<I extends string | number, R> = (body: R, opts?: {
    req: Request;
    res: Response;
}) => Promise<R & {
    id: I;
}>;
export declare const create: <I extends string | number, R>(doCreate: Create<I, R>) => RequestHandler;
