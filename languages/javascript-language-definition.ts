import LanguageDefinition from "./language-definition";

class JavascriptLanguageDefinition implements LanguageDefinition {
  fileExtension = 'js';
  useDataclassForModels = false;
  needDeclareFields = false;
  isTypesafeLanguage =false;
  thisKeyword = 'this';
  constKeyword = 'const';
  variableKeyword = 'let';
  nullKeyword = 'null';
  anyTypeKeyword = '';
  intKeyword = 'int';
  numberKeyword = 'float';
  stringKeyword = 'string';
  booleanKeyword = 'bool';
  falseKeyword = 'false';
  trueKeyword = 'true';
  arrayKeyword = 'array';
  arrayListKeyword = '[]';
  shouldConstructList = false;
  mapKeyword = 'map';
  publicKeyword = '';
  privateKeyword = '';
  stringReplacement = '%s';
  equalMethodName = 'isEqual';
  varargsKeyword = '...';
  constructorAlsoDeclareFields = false;

  importDeclarations(imports: Array<string>): string {
      return imports.map((importFile) => {
          return `const ${importFile} = require(${this.stringDeclaration(`./${importFile}`)});`;
      }).join('\n');
  }

  classDeclaration(className, inheritsFrom, body, _isDataClass, _constructors): string {
      let inherits = '';
      if (inheritsFrom) {
          inherits = ` extends ${inheritsFrom}`;
      }
      return `class ${className}${inherits} {\n\n${body}\n}`;
  }

  methodDeclaration(methodName, parameters, _returnType, body): string {
      return `${methodName}(${this.printParametersNamesWithTypes(parameters)}) {
${body}
\t}`;
  }

  printParametersNamesWithTypes(parameters, shouldBreakLine = false): string {
      let separator = ', ';
      if (shouldBreakLine) {
          separator = ',\n\t\t';
      }
      if (!parameters || parameters.length == 0) {
          return '';
      }
      return parameters.map((parameter) => {
          return parameter.name;
      }).join(separator);
  }

  parameterDeclaration(parameter): string {
      return parameter.name
  }

  printValues(values, shouldBreakLine): string {
      if (!values || values.length === 0) {
          return '';
      }
      let separator = ', ';
      if (values[0].indexOf('\t') > -1 || (values.length > 1 && values[1].indexOf('\t') > -1)) {
          separator = ',\n\t\t\t';
      }
      if (shouldBreakLine) {
          separator = ',\n\t\t\t';
      }
      return values.map((value) => {
          return `${value}`;
      }).join(separator);
  }

  fieldDeclaration(_visibility, name, _type, defaultValue): string {
      let field = `get ${name}() {\n`;
      if (defaultValue) {
          field += `\t\t${this.returnDeclaration(defaultValue)}`;
      }
      field += '\n\t}';
      return field;
  }

  methodCall(caller, methodName, parameterValues): string {
      let callerString = '';
      if (caller) {
          callerString = `${caller}.`;
      }
      let shouldBreakLine = true;
      if (parameterValues && parameterValues.length < 3) {
          shouldBreakLine = false;
      }
      return `${callerString}${methodName}(${this.printValues(parameterValues, shouldBreakLine)})`;
  }

  variableDeclaration(declareType, _type, name, defaultValue): string {
      let variable = `${declareType} ${name}`;
      if (defaultValue) {
          variable += ` = ${defaultValue}`;
      }
      return variable += ';';
  }

  returnDeclaration(value): string {
      return `return ${value};`;
  }

  constructorDeclaration(_className, parameters, _returnType, _body, _isDataClass): string {
      return `contructor(${this.printParametersNamesWithTypes(parameters)}) {
${parameters.map((value) => {
      return `\t\tthis.${value.name} = ${value.name};`;
  }).join('\n')}
\t}`;
  }

  enumDeclaration(enumName, values): string {
      return `\tclass ${enumName} {
  ${values.map((value, index) => {
      return `\t\t${value} = ${index}`;
  }).join(',\n')}
\t}`;
  }

  ifStatement(condition, body): string {
      return `if (${condition}) {
  ${body}
\t\t}`;
  }

  whileStatement(condition, body): string {
      return `while (${condition}) {
  ${body}
\t\t}`;
  }

  lambdaMethod(caller, method, varName, body): string {
      return `${caller}.${method} { (${varName}) ->
  ${body}
\t\t}`;
  }

  ifNullStatement(object, body): string {
      return this.ifStatement(`!${object}`, body);
  }

  assignment(name1, name2): string {
      return `${name1} = ${name2};`;
  }

  constructObject(type, parameters): string {
      return `new ${this.methodCall(null, type, parameters)}`;
  }

  stringDeclaration(content): string {
      return `'${content}'`;
  }

  tryCatchStatement(tryBody, catchBody, finallyBody): string {
      return `\t\ttry {
  ${tryBody}
\t\t} catch (error) {
  ${catchBody}
\t\t} finally {
  ${finallyBody}
\t\t}`
  }

  compareTypeOfObjectsMethod(_var1, _var2, _negative): string {
      return '';
  }

  equalMethod(var1, var2, negative): string {
      let equal = '===';
      if (negative) {
          equal = '!==';
      }
      return `${var1} ${equal} ${var2}`;
  }    

  simpleComparison(var1, var2, negative): string {
      let equal = '==';
      if (negative) {
          equal = '!=';
      }
      return `${var1} ${equal} ${var2}`;
  }
}

export default JavascriptLanguageDefinition;