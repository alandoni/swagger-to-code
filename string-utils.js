module.exports = class StringUtils {
  static get regex() {
    return new RegExp('(?=[A-Z])','g');
  }
  static splitNameWithUnderlines(name) {
    const names = name.split(this.regex);
    return names.join('_');
  }
}