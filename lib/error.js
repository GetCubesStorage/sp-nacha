'use strict';
// Create a new object, that prototypal inherits from the Error constructor.
class nACHError extends Error {
  constructor(errorObj) {
    this.name = 'nACHError[' + errorObj.name + ']' || 'nACHError';
    this.message = errorObj.message || 'Uncaught nACHError';
  }
}

module.exports = nACHError;