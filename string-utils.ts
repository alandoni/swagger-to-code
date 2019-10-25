class StringUtils {
  static regex = new RegExp('(?=[A-Z])','g');

  static splitNameWithUnderlines(name: String): String {
    const names = name.split(this.regex);
    return names.join('_');
  }
}

export default StringUtils;