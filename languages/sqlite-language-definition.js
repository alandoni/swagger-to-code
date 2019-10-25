module.exports = class SqliteLanguageDefinition {
<<<<<<< Updated upstream
  get createTable() {
    return 'CREATE TABLE IF NOT EXISTS';
  }

  get dropTableKeyword() {
    return 'DROP TABLE';
  }

  get insertIntoKeyword() {
    return 'INSERT INTO';
  }

  get updateKeyword() {
    return 'UPDATE';
  }

  get insertOrUpdateKeyword() {
    return 'INSERT OR UPDATE INTO';
  }

  get deleteKeyword() {
    return `DELETE ${this.fromKeyword}`;
  }

  get selectKeyword() {
    return 'SELECT';
  }

  get selectAllFieldsKeyword() {
    return 'SELECT *';
  }

  get fromKeyword() {
    return 'FROM';
  }

  get setKeyword() {
    return 'SET';
  }

  get valuesKeyword() {
    return 'VALUES';
  }

  get whereKeyword() {
    return 'WHERE';
  }

  get orderByKeyword() {
    return 'ORDER BY';
  }

  get betweenKeyword() {
    return 'BETWEEN';
  }

  get integerKeyword() {
    return 'INTEGER';
  }

  get stringKeyword() {
    return 'TEXT';
  }

  get numberKeyword() {
    return 'REAL';
  }

  get booleanKeyword() {
    return self.integerKeyword;
  }

  get notNullKeyword() {
    return 'NOT NULL';
  }

  get primaryKeyKeyword() {
    return 'PRIMARY KEY';
  }

  get parameterKeyword() {
    return '?';
  }

  get inKeyword() {
    return 'IN';
  }
=======
  createTable = 'CREATE TABLE IF NOT EXISTS';
  dropTableKeyword = 'DROP TABLE';
  insertIntoKeyword = 'INSERT INTO';
  updateKeyword = 'UPDATE';
  insertOrUpdateKeyword = 'INSERT OR UPDATE INTO';
  deleteKeyword = `DELETE ${this.fromKeyword}`;
  selectKeyword = 'SELECT';
  selectAllFieldsKeyword = 'SELECT *';
  fromKeyword = 'FROM';
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
>>>>>>> Stashed changes
}