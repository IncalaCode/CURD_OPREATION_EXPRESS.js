import { RequestHandler, Request, Response } from 'express';
export declare type Destroy = (id: string, opts?: {
    req: Request;
    res: Response;
}) => Promise<any>;
export declare const destroy: (doDestroy: Destroy) => RequestHandler;
