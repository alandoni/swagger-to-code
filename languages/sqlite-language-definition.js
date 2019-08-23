module.exports = class SqliteLanguageDefinition {
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

  get deleteKeyword() {
    return `DELETE ${this.fromKeyword}`;
  }

  get selectKeyword() {
    return 'SELECT';
  }

  get fromKeyword() {
    return 'FROM'
  }

  get setKeyword() {
    return 'SET'
  }

  get valuesKeyword() {
    return 'VALUES'
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
    return 'PRIMARY KEY'
  }

  get parameterKeyword() {
    return '?';
  }
}