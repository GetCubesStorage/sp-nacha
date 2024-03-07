'use strict';
// Create a new object, that prototypal inherits from the Error constructor.
class nACHError {
  constructor(errorObj) {
    this.name = 'nACHError[' + errorObj.name + ']' || 'nACHError';
    this.message = errorObj.message || 'Uncaught nACHError';
  }
}
nACHError.prototype = Object.create(Error.prototype);
;

module.exports = nACHError;