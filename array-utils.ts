export default class ArrayUtils {
  static removeDuplicates(array: Array<any>): Array<any> {
    var dups = new Map<Object, boolean>();
      return array.filter(function(item) {
        var hash = JSON.stringify(item.valueOf());
        var isDup = dups[hash];
        dups[hash] = true;
        return !isDup;
      });
  }
}