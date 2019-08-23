const regex = new RegExp('(?=[A-Z])','g');

module.exports = class StringUtils {
  static splitNameWithUnderlines(name) {
    const names = name.split(regex)
    return names.join('_');
  }
}