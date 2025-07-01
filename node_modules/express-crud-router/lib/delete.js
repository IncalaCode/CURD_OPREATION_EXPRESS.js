"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.destroy = void 0;

const destroy = doDestroy => async (req, res, next) => {
  try {
    await doDestroy(req.params.id, {
      req,
      res
    });
    res.json({
      id: req.params.id
    });
  } catch (error) {
    next(error);
  }
};

exports.destroy = destroy;