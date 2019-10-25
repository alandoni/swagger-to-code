class SqliteLanguageDefinition {
  createTable = 'CREATE TABLE IF NOT EXISTS';
  dropTableKeyword = 'DROP TABLE';
  insertIntoKeyword = 'INSERT INTO';
  updateKeyword = 'UPDATE';
  insertOrUpdateKeyword = 'INSERT OR UPDATE INTO';
  fromKeyword = 'FROM';
  deleteKeyword = `DELETE ${this.fromKeyword}`;
  selectKeyword = 'SELECT';
  selectAllFieldsKeyword = 'SELECT *';
  setKeyword = 'SET';
  valuesKeyword = 'VALUES';
  whereKeyword = 'WHERE';
  orderByKeyword = 'ORDER BY';
  betweenKeyword = 'BETWEEN';
  integerKeyword = 'INTEGER';
  stringKeyword = 'TEXT';
  numberKeyword = 'REAL';
  booleanKeyword = this.integerKeyword;
  notNullKeyword = 'NOT NULL';
  primaryKeyKeyword = 'PRIMARY KEY';
  parameterKeyword = '?';
  inKeyword = 'IN';
}

export default SqliteLanguageDefinition;