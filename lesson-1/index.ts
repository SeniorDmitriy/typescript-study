type defObj = {
  symbol: string,
  separator: string,
  decimal: string,
  formatWithSymbol: boolean,
  errorOnInvalid: boolean,
  precision: number,
  pattern: string,
  negativePattern: string,
}
interface dopFields {
  increment?: number,
  useVedic?: boolean,
  groups?: RegExp,
  decimal?: string,
  errorOnInvalid?: boolean,
  precision?: number,
}

const defaults: defObj = {
  symbol: '$',
  separator: ',',
  decimal: '.',
  formatWithSymbol: false,
  errorOnInvalid: false,
  precision: 2,
  pattern: '!#',
  negativePattern: '-!#'
};

const round = (v: number): number => Math.round(v);
const pow = (p: number): number => Math.pow(10, p);
const rounding = (value: number, increment: number): number => round(value / increment) * increment;

type regEx = RegExp;

const groupRegex: regEx = /(\d)(?=(\d{3})+\b)/g;
const vedicRegex: regEx = /(\d)(?=(\d\d)+\d\b)/g;

/**
* Create a new instance of Currency.js
* @param {number|string|Currency} value
* @param {object} [opts]
*/

class Currency {
  intValue: number;
  value: number | string;
  _settings: dopFields & defObj;
  _precision: number;
  constructor(value: number | string | Currency, opts: dopFields) {

    if (!(value instanceof Currency)) {
      this.value = value;
    }

    let settings = (<any>Object).assign({}, defaults, opts)
      , precision = pow(settings.precision)
      , v = parse(this.value, settings);

    this.intValue = v;
    this.value = v / precision;

    // Set default incremental value
    settings.increment = settings.increment || (1 / precision);

    // Support vedic numbering systems
    // see: https://en.wikipedia.org/wiki/Indian_numbering_system
    if (settings.useVedic) {
      settings.groups = vedicRegex;
    } else {
      settings.groups = groupRegex;
    }

    // Intended for internal usage only - subject to change
    this._settings = settings;
    this._precision = precision;
  }

  /**
   * Adds values together.
   * @param {number} number
   * @returns {Currency}
   */

  add(number: number): Currency {
    let { intValue, _settings, _precision } = this;
    return new Currency((intValue += parse(number, _settings)) / _precision, _settings);
  }

  /**
   * Subtracts value.
   * @param {number} number
   * @returns {Currency}
   */
  subtract(number: number): Currency {
    let { intValue, _settings, _precision } = this;
    return new Currency((intValue -= parse(number, _settings)) / _precision, _settings);
  }

  /**
   * Multiplies values.
   * @param {number} number
   * @returns {Currency}
   */
  multiply(number: number): Currency {
    let { intValue, _settings } = this;
    return new Currency((intValue *= number) / pow(_settings.precision), _settings);
  }

  /**
   * Divides value.
   * @param {number} number
   * @returns {Currency}
   */
  divide(number: number): Currency {
    let { intValue, _settings } = this;
    return new Currency(intValue /= parse(number, _settings, false), _settings);
  }

  /**
   * Takes the Currency amount and distributes the values evenly. Any extra pennies
   * left over from the distribution will be stacked onto the first set of entries.
   * @param {number} count
   * @returns {array}
   */
  distribute(count: number): number[] | object[] {
    let { intValue, _precision, _settings } = this
      , distribution = []
      , split = Math[intValue >= 0 ? 'floor' : 'ceil'](intValue / count)
      , pennies = Math.abs(intValue - (split * count));

    for (; count !== 0; count--) {
      let item = new Currency(split / _precision, _settings);

      // Add any left over pennies
      pennies-- > 0 && (item = intValue >= 0 ? item.add(1 / _precision) : item.subtract(1 / _precision));

      distribution.push(item);
    }

    return distribution;
  }

  /**
   * Returns the dollar value.
   * @returns {number}
   */
  dollars(): number {
    console.log(this.value);

    return ~~this.value;
  }

  /**
   * Returns the cent value.
   * @returns {number}
   */
  cents(): number {
    let { intValue, _precision } = this;
    return ~~(intValue % _precision);
  }

  /**
   * Formats the value as a string according to the formatting settings.
   * @param {boolean} useSymbol - format with Currency symbol
   * @returns {string}
   */
  format(useSymbol: boolean): string {
    let { pattern, negativePattern, formatWithSymbol, symbol, separator, decimal, groups } = this._settings
      , values = (this + '').replace(/^-/, '').split('.')
      , dollars = values[0]
      , cents = values[1];

    // set symbol formatting
    typeof (useSymbol) === 'undefined' && (useSymbol = formatWithSymbol);

    return (this.value >= 0 ? pattern : negativePattern)
      .replace('!', useSymbol ? symbol : '')
      .replace('#', `${dollars.replace(groups, '$1' + separator)}${cents ? decimal + cents : ''}`);
  }

  /**
   * Formats the value as a string according to the formatting settings.
   * @returns {string}
   */

  toString(): string {
    let { intValue, _precision, _settings } = this;
    return rounding(intValue / _precision, _settings.increment).toFixed(_settings.precision);
  }

  /**
   * Value for JSON serialization.
   * @returns {float}
   */
  toJSON(): string | number {
    return this.value;
  }
}

function parse(value: number | string | Currency, opts: dopFields, useRounding = true) {

  let v = 0
    , { decimal, errorOnInvalid, precision: decimals } = opts
    , precision = pow(decimals)
    , isNumber = typeof value === 'number';

  if (isNumber || value instanceof Currency) {
    v = (+(isNumber ? value : Currency.prototype.value) * precision);
  } else if (typeof value === 'string') {
    let regex = new RegExp('[^-\\d' + decimal + ']', 'g')
      , decimalString = new RegExp('\\' + decimal, 'g');
    v = +value
      .replace(/\((.*)\)/, '-$1')   // allow negative e.g. (1.99)
      .replace(regex, '')           // replace any non numeric values
      .replace(decimalString, '.')  // convert any decimal values
      * precision                // scale number to integer value
    v = v || 0;
  } else {
    if (errorOnInvalid) {
      throw Error('Invalid Input');
    }
    v = 0;
  }

  // Handle additional decimal for proper rounding.
  v = +v.toFixed(4);

  return useRounding ? round(v) : v;
}

export default Currency;

