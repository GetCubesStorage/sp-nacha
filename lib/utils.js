// Utility Functions

let _ = require('lodash');
let moment = require('moment');
let nACHError = require('./error');
let counter = 0;

// Pad a given string to a fixed width using any character or number (defaults to one blank space)
// Both a string and width are required params for this function, but it also takes two optional
// parameters. First, a boolean called 'padRight' which by default is true. This means padding 
// will be applied to the right side of the string. Setting this to false will pad the left side of the
// string. You can also specify the character you want to use to pad the string.
function pad(string, width) {
    let padRight;
    let padChar;
    let result;
    string = string + '';

    if (typeof arguments[2] == 'boolean') {
        padRight = arguments[2];
        padChar = arguments[3] || ' ';
    } else if (typeof arguments[3] == 'boolean') {
        padRight = arguments[3];
        padChar = arguments[2];
    } else {
        padRight = true; // padRight is true be default
        padChar = arguments[2] || ' '; // The padding character is just a space by default
    }

    if (string.length >= width) {
        return string;
    } else {
        result = new Array(width - string.length + 1).join(padChar);
        return padRight ? string + result : result + string;
    }
}


function computeCheckDigit(routing) {
    let a = routing.split('').map(Number);

    return a.length !== 8 ? routing : routing + (7 * (a[0] + a[3] + a[6]) + 3 * (a[1] + a[4] + a[7]) + 9 * (a[2] + a[5])) % 10;
}

// This function is passed a field and a regex and tests the field's value property against the given regex
function testRegex(regex, field) {

    let string = field.number ? parseFloat(field.value).toFixed(2).replace(/\./, '') : field.value;
    if ((field.value) || (field.required && !field.value)) {
        if (!regex.test(string)) {
            throw new nACHError({
                name: 'Invalid Data Type',
                message: field.name + '\'s data type is required to be ' + field.type + ', but its contents don\'t reflect that.'
            });
        }
    }

    return true;
}

// This function iterates through the object passed in and checks to see if it has a "position" property. If so, we pad it, and then concatentate it where belongs.
/**
 * 
 * @param {Record<string, any>} object 
 * @param {(res: string) => void} cb 
 */
function generateString(object, cb) {
    let counter = 1;
    let result = '';
    let objectCount;

    // How does this actually work? It doens't seem like this is enough protection from iterating infinitely.
    objectCount = _.size(object);

    while (counter < objectCount) {
        _.forEach(object, function (field) {
            if (field.position === counter) {
                if (field.blank === true || field.type === 'alphanumeric') {
                    result = result + pad(field.value, field.width);
                } else {
                    let string = field.number ? parseFloat(field.value).toFixed(2).replace(/\./, '') : field.value;
                    let paddingChar = field.paddingChar || '0';
                    result = result + pad(string, field.width, false, paddingChar);
                }
                counter++;
            }
        });
    }
    cb(result);
}

function unique() {
    return counter++;
}

function overrideLowLevel(values, options, self) {
    // For each override value, check to see if it exists on the options object & if so, set it
    _.forEach(values, function (field) {
        if (options[field]) {
            self.set(field, options[field]);
        }
    });
}

function getNextMultiple(value, multiple) {
    return value % multiple === 0 ? value : value + (multiple - value % multiple);
}

function getNextMultipleDiff(value, multiple) {
    return (getNextMultiple(value, multiple) - value);
}

// This allows us to create a valid ACH date in the YYMMDD format
let formatDate = function (date) {
    let year = pad(date.getFullYear().toString().slice(-2), 2, false, '0');
    let month = pad((date.getMonth() + 1).toString(), 2, false, '0');
    let day = pad(date.getDate().toString(), 2, false, '0');

    return year + month + day;
};

// Create a valid timestamp used by the ACH system in the HHMM format
let formatTime = function (date) {
    let hour = date.getHours().toString();
    let minute = date.getMinutes().toString();

    return pad(hour, 2, false, '0') + pad(minute, 2, false, '0');
};

let isBusinessDay = module.exports.isBusinessDay = function (day) {
    let d = moment(day).day();
    return (d !== 0 && d !== 6);
};

// This function takes an optional starting date to iterate from based
let computeBusinessDay = module.exports.computeBusinessDay = function (businessDays) {
    let day = arguments[1] ? moment(arguments[1]) : moment();
    let counter = 0;

    function addDays() {
        day.add(1, 'days');
        if (isBusinessDay(day)) {
            counter++;
        }
        return (counter === businessDays) ? day.toDate() : addDays();
    }

    return addDays();
};

let newLineChar = function () {
    return '\r\n';
};

module.exports.pad = pad;
module.exports.unique = unique;
module.exports.testRegex = testRegex;
module.exports.formatDate = formatDate;
module.exports.formatTime = formatTime;
module.exports.newLineChar = newLineChar;
module.exports.generateString = generateString;
module.exports.getNextMultiple = getNextMultiple;
module.exports.overrideLowLevel = overrideLowLevel;
module.exports.computeCheckDigit = computeCheckDigit;
module.exports.computeBusinessDay = computeBusinessDay;
module.exports.getNextMultipleDiff = getNextMultipleDiff;