const StringUtils = require('../string-utils');

const PropertyDefinition = require('./definitions/property-definition');
const MethodDefinition = require('./definitions/method-definition');
const ClassDefinition = require('./definitions/class-definition');
const TypeDefinition = require('./definitions/type-definition');
const ParameterDefinition = require('./definitions/parameter-definition');

const ModelClassParser = require('./model-class-parser');

const YamlDefinitionRelationship = require('./yaml-definition/yaml-definition-relationship');

const STRING_TO_ARRAY_SEPARATOR = ';';

module.exports = class DatabaseTableSchemaClassParser {
    constructor() {
        this.classSufix = 'TableSchema';
        this.tableNameProperty = 'TABLE_NAME';
        this.databaseObject = new ParameterDefinition('db', new TypeDefinition('SQLiteDatabase'));
    }

    parse(languageDefinition, databaseLanguageDefinition, definition) {
        const nativeDependencies = [
            new TypeDefinition('android.database.sqlite.SQLiteDatabase'),
            new TypeDefinition('android.database.Cursor'),
        ];
        const className = definition.name;
        const tableClassName = `${className}${this.classSufix}`;

        const fields = this.parseProperties(databaseLanguageDefinition, languageDefinition, definition);
        
        const parseDependencies = ModelClassParser.parseDependencies(definition);

        const dependencies = [
            ...nativeDependencies, 
            ...parseDependencies.map((dependency) => {
                return new TypeDefinition(dependency.name);
            }),
            ...parseDependencies.map((dependency) => {
                if (dependency.needsTable) {
                    return new TypeDefinition(`${dependency.name}${this.classSufix}`);
                }
                return null;
            }).filter((dependency) => {
                return dependency != null;
            }),
        ];
        
        let tableNameString = new PropertyDefinition(
            this.tableNameProperty,
            new TypeDefinition(languageDefinition.stringKeyword),
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(className).toLowerCase()),
            null,
            false);

        const methods = [
            this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, fields),
            this.createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, className, fields),
            this.createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, className, fields),
            this.createBatchInsertOrUpdateMethod(languageDefinition, className),
            this.createDeleteMethod(languageDefinition, databaseLanguageDefinition),
            this.createReadListFromDbMethod(languageDefinition, className),
            this.createSelectMethod(languageDefinition, className),
            this.createSelectAllMethod(languageDefinition, databaseLanguageDefinition, className),
            this.createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, className),
            ...this.createMethodsBasedOnDependencies(languageDefinition, databaseLanguageDefinition, definition, className, fields),
        ];

        const properties = this.getAllProperties(languageDefinition, tableNameString, fields);

        const tableClass = new ClassDefinition(tableClassName, properties, null, methods, null, dependencies);

        return tableClass;
    }

    getAllProperties(languageDefinition, tableNameString, fields) {
        const properties = [tableNameString, ...fields.filter((field) => {
            return !field.fromClass;
        }).map((field) => {
            return field.toProperty(languageDefinition);
        })];

        fields.filter((field) => {
            return field.fromClass;
        }).map((field) => {
            field.fromClass.map((newField) => {
                properties.push(newField.toProperty(languageDefinition));
            });
        });
        return properties;
    }

    parseProperties(databaseLanguageDefinition, languageDefinition, definition) {
        let fields = definition.properties.map((property) => {
            let subObject = null;
            const subProperties = property.subProperties;
            if (subProperties ) {
                const propertiesFromClass = subProperties.map((subProperty) => {
                    const prefix = property.name;
                    subObject = new DatabaseFieldHelper(
                        databaseLanguageDefinition,
                        languageDefinition,
                        subProperty.name,
                        ModelClassParser.getPropertyType(languageDefinition, subProperty),
                        subProperty.required, null);
                    subObject.fieldName = `${prefix.toUpperCase()}_${subObject.fieldName}`;
                    subObject.databaseFieldName = `${prefix}_${subObject.databaseFieldName}`;
                    subObject.fromClass = property.name;
                    return subObject;
                });

                return new DatabaseFieldHelper(databaseLanguageDefinition,
                    languageDefinition,
                    property.name,
                    ModelClassParser.getPropertyType(languageDefinition, property),
                    property.required,
                    propertiesFromClass);
            }

            return new DatabaseFieldHelper(databaseLanguageDefinition, languageDefinition,
                property.name,
                ModelClassParser.getPropertyType(languageDefinition, property),
                property.required,
                subObject);
        });

        return fields;
    }

    createCreateTableMethod(languageDefinition, databaseLanguageDefinition, fields) {
        let typedFields = fields.filter((field) => {
            return !field.searchById && !field.fromClass;
        });

        fields.filter((field) => {
            return field.fromClass;
        }).map((field) => {
            field.fromClass.map((field) => {
                typedFields.push(field);
            });
        });

        const databaseFields = typedFields.map((field) => {
            const properties = field.getDatabaseFieldProperties(databaseLanguageDefinition);

            try {
                let fieldString = `\t\t\t\t\`${languageDefinition.stringReplacement}\` ${field.databaseType.print()}`;
                if (properties) {
                    fieldString += ` ${properties}`;
                }
                return fieldString;
            } catch (e) {
                console.log(field);
            }
        }).join(',\n');

        const parameters = typedFields.map((field) => {
            return `\t\t${languageDefinition.thisKeyword}.${field.fieldName}`;
        });

        const tablePlusParameters = [`${languageDefinition.thisKeyword}.TABLE_NAME`, ...parameters];
        
        const tableString = languageDefinition.stringDeclaration(`${databaseLanguageDefinition.createTable} \`${languageDefinition.stringReplacement}\` (
    ${databaseFields}
\t\t\t)`);
        const methodCall = `${languageDefinition.methodCall(tableString, 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${languageDefinition.methodCall('db', 'execSQL', [methodCall])};`;

        return new MethodDefinition('createTable', 
            new TypeDefinition(languageDefinition.voidReturnKeyword),
            [
                this.databaseObject
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    classNameToVar(className) {
        return className.substr(0, 1).toLowerCase() + className.substr(1);
    }

    varNameToClass(className) {
        return className.substr(0, 1).toUpperCase() + className.substr(1);
    }

    createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, className, fields) {
        const varName = this.classNameToVar(className);

        const parameters = fields.map((field) => {
            const nonNative = this.handleNonNativeTypes(languageDefinition, className, field);
            if (nonNative) {
                return nonNative;
            }
            switch(field.databaseType.name) {
                case databaseLanguageDefinition.numberKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getDouble', [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case databaseLanguageDefinition.stringKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getString',  [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case databaseLanguageDefinition.integerKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getInt',  [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                default:
                   // throw new Error(`QUE? ${JSON.stringify(field)}`);
            }
        });

        let methodString = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, 
            new TypeDefinition(className), 
            varName, 
            languageDefinition.constructObject(className, parameters))}`;
        methodString += `\n\t\t${languageDefinition.returnDeclaration(varName)}`;

        return new MethodDefinition('readFromDb', 
            new TypeDefinition(className),
            [   
                new ParameterDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    handleNonNativeTypes(languageDefinition, className, field) {
        if (field.fromClass) {
            const params = field.fromClass.map((field) => {
                return languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            });

            return languageDefinition.constructObject(field.type.name, params);
        }
        if (field.searchByDependencyId) {
            const constructObject = languageDefinition.constructObject(`${field.type.name}${this.classSufix}`);
            let getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                constructObject, 
                `selectById`, [getId])}`;
        }
        if (field.searchById) {
            const constructObject = languageDefinition.constructObject(`${className}${this.classSufix}`);
            let getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                constructObject, 
                `selectBy${className}Id`, [getId])}`;
        }
        if (field.isArrayOfString) {
            const callCursorGetStringMethod = languageDefinition.methodCall('cursor', 'getString', 
                [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                callCursorGetStringMethod, 
                'split', [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)]
            )}`;
        }
        return null;
    }

    createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, className, properties) {
        const interrogations = [];
        const stringReplacements = [];

        const objectName = this.classNameToVar(className);

        const { onlyNativeTypes, nonNativeTypes } = this.getFieldsSeparatedByNative(properties)

        onlyNativeTypes.filter((property) => {
            return property.fieldName !== 'id';
        }).map(() => {
            interrogations.push('?');
            stringReplacements.push(`\`${languageDefinition.stringReplacement}\``);
        });

        const sql = `${languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.insertOrUpdateKeyword} \`${languageDefinition.stringReplacement}\` (${stringReplacements.join(', ')}) ${databaseLanguageDefinition.valuesKeyword} (${interrogations.join(', ')})`)}`;
        
        const statement = `${languageDefinition.methodCall(sql, 'format', this.getFields(languageDefinition, onlyNativeTypes, objectName))}`;
        
        const callExecSqlMethod = languageDefinition.methodCall('db', 'execSQL', [statement]);

        let methodString = `\t\t${languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        if (nonNativeTypes.length > 0) {
            methodString = this.getInsertMethodForNonNativeTypes(languageDefinition, nonNativeTypes, objectName, methodString, statement);
        }

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(languageDefinition.intKeyword),
            [
                this.databaseObject,
                new ParameterDefinition(`${objectName}`, new TypeDefinition(`${className}`))
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    getInsertMethodForNonNativeTypes(languageDefinition, nonNativeTypes, objectName, methodString, statement) {
        const methods = nonNativeTypes.filter((property) => {
            return property.type.subtype != null;
        }).map((property) => {
            let methodName = 'insertOrUpdate';
            if (property.type.name.indexOf(languageDefinition.arrayKeyword) > -1) {
                methodName = 'batchInsertOrUpdate';
            }
            const constructObject = languageDefinition.constructObject(`${property.type.subtype.name}${this.classSufix}`);
            return `\t\t${languageDefinition.methodCall(constructObject, methodName, ['db', `${objectName}.${property.propertyName}`])};`;
        }).join('\n');

        const callExecSqlMethod = languageDefinition.methodCall('db', 'execSQL', [statement]);
        methodString = `\t\t${languageDefinition.variableDeclaration(
            languageDefinition.constKeyword, 
            new TypeDefinition(languageDefinition.intKeyword), 
            'result',
            callExecSqlMethod)}

${methods}

\t\t${languageDefinition.returnDeclaration('result')}`;
        return methodString;
    }

    getFieldsSeparatedByNative(properties) {
        const onlyNativeTypes = [];
        const nonNativeTypes = [];

        properties.forEach((property) => {
            if (this.checkIfPropertyIsNativeType(property)) {
                onlyNativeTypes.push(property);
            } else {
                if (property.fromClass) {
                    property.fromClass.forEach((property) => {
                        if (this.checkIfPropertyIsNativeType(property)) {
                            onlyNativeTypes.push(property);
                        } else {
                            nonNativeTypes.push(property);
                        }
                    });
                } else if (property.isArrayOfString || property.type.subtype) {
                    nonNativeTypes.push(property);
                } else {
                    onlyNativeTypes.push(property);
                }
            }
        });

        return { onlyNativeTypes, nonNativeTypes };
    }

    checkIfPropertyIsNativeType(property) {
        return (property.type.isNative && !property.type.subtype) || property.isArrayOfString || property.enumDefinition;
    }

    getFields(languageDefinition, properties, objectName) {
        let fields = [`${languageDefinition.thisKeyword}.TABLE_NAME`];
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            return `${languageDefinition.thisKeyword}.${property.fieldName}`;
        }));
        
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            if (property.isArrayOfString) {
                return `${languageDefinition.methodCall(`${objectName}.${property.propertyName}`, 'join', 
                    [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)])}`;
            }
            if (property.fromClass) {
                return `${objectName}.${property.fromClass}.${property.propertyName}`;
            } else if (!property.type.isNative && !property.type.subtype) {
                return `${objectName}.${property.propertyName}.id`;
            } else {
                return `${objectName}.${property.propertyName}`;
            }
        }));
        return fields;
    }

    createBatchInsertOrUpdateMethod(languageDefinition, className) {
        const objectName = this.classNameToVar(className);

        const callInsertOrUpdateMethod = languageDefinition.methodCall(languageDefinition.thisKeyword, 'insertOrUpdate', ['db', objectName]);
        let mapBodyString = `\t\t${languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        const callMapMethod = languageDefinition.lambdaMethod(objectName, 'map', objectName, mapBodyString);
        let methodString = `\t\t${languageDefinition.returnDeclaration(callMapMethod)}`;

        return new MethodDefinition('batchInsertOrUpdate',
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(languageDefinition.intKeyword)),
            [
                this.databaseObject, 
                new ParameterDefinition(objectName, new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className))),
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    createDeleteMethod(languageDefinition, databaseLanguageDefinition) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.deleteKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall('db', 'execSQL', [formatMethodCall, 'id']);
        const returnCall = `\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;
        return new MethodDefinition('deleteById',
            new TypeDefinition(languageDefinition.intKeyword),
            [
                this.databaseObject, 
                new ParameterDefinition('id', new TypeDefinition(languageDefinition.intKeyword)),
            ],
            returnCall,
            languageDefinition.publicKeyword);
    }

    createReadListFromDbMethod(languageDefinition, className) {
        const listDeclaration = this.createListObject(languageDefinition, className);

        const cursorMoveToNext = languageDefinition.methodCall('cursor', 'moveToNext');
        const readFromDbMethodCall = languageDefinition.methodCall('readFromDb', ['cursor']);
        const whileBody = `\t\t${languageDefinition.methodCall('list', 'add', [readFromDbMethodCall])}`;
        const whileStatement = languageDefinition.whileStatement(cursorMoveToNext, whileBody);
        const returnCall = `${languageDefinition.returnDeclaration('list')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${whileStatement}
\t\t${returnCall}`
        return new MethodDefinition('readListFromDb', 
            new TypeDefinition(languageDefinition.intKeyword),
            [
                new ParameterDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }

    createListObject(languageDefinition, className) {
        let listConstruct = languageDefinition.arrayListKeyword;
        if (languageDefinition.shouldConstructList) {
            listConstruct = languageDefinition.constructObject(languageDefinition.arrayListKeyword);
        }
        const listDeclaration = languageDefinition.variableDeclaration(
            languageDefinition.constKeyword, 
            new TypeDefinition(languageDefinition.arrayListKeyword, new TypeDefinition(className)),
            'list',
            listConstruct);
        return listDeclaration;
    }

    createSelectMethod(languageDefinition, className) {
        const cursorDeclaration = languageDefinition.variableDeclaration(
            languageDefinition.variableKeyword, 
            new TypeDefinition('Cursor'),
            'cursor');
        const listDeclaration = this.createListObject(languageDefinition, className);

        const dbExecCall = languageDefinition.methodCall('db', 'rawQuery', ['sql', 'args']);
        const assignRawQueryToCursor = languageDefinition.assignment('cursor', dbExecCall);
        const callReadListFromDbMethod = languageDefinition.methodCall(languageDefinition.thisKeyword, 'readListFromDb', ['cursor']);
        const assignList = languageDefinition.assignment('list', callReadListFromDbMethod);
        const tryBody = `\t\t${assignRawQueryToCursor}
\t\t\t${assignList}`;
        const catchBody = `\t\t\t${languageDefinition.methodCall(languageDefinition.thisKeyword, 'onError')}`;
        const finallyBody = `\t\t\t${languageDefinition.methodCall('cursor', 'close')}
\t\t\t${languageDefinition.methodCall('db', 'close')}`;
        const tryCatch = languageDefinition.tryCatchStatement(tryBody, catchBody, finallyBody);

        const returnCall = languageDefinition.returnDeclaration('list');

        const methodBody = `\t\t${listDeclaration}
\t\t${cursorDeclaration}

${tryCatch}

\t\t${returnCall}`;

        return new MethodDefinition('select', 
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className)),
            [
                this.databaseObject,
                new ParameterDefinition('sql', new TypeDefinition(languageDefinition.stringKeyword)),
                new ParameterDefinition('args', new TypeDefinition(languageDefinition.stringKeyword), null, false, [languageDefinition.varargsKeyword]),
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }

    createSelectAllMethod(languageDefinition, databaseLanguageDefinition, className) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = languageDefinition.methodCall(languageDefinition.thisKeyword, 'select', [formatMethodCall, languageDefinition.nullKeyword]);
        
        const returnCall = `\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition('selectAll', 
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className)),
            [
                this.databaseObject,
            ],
            returnCall,
            languageDefinition.publicKeyword);
    }

    createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, className) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
                [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall(languageDefinition.thisKeyword, 'select', [formatMethodCall, 'id']);

        const listDeclaration = languageDefinition.variableDeclaration(
            languageDefinition.constKeyword, 
            new TypeDefinition(languageDefinition.arrayListKeyword, new TypeDefinition(className)),
            'list', dbExecCall);

        const returnCall = `${languageDefinition.returnDeclaration('list[0]')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${returnCall}`;

        return new MethodDefinition('selectById',
            new TypeDefinition(className),
            [
                this.databaseObject,
                new ParameterDefinition('id', new TypeDefinition(languageDefinition.intKeyword)),
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }

    createMethodsBasedOnDependencies(languageDefinition, databaseLanguageDefinition, definition, className, fields) {
        const methods = definition.references.filter((reference) => {
            return reference.relationship != YamlDefinitionRelationship.ONE_TO_ONE;
        }).map((reference) => {
            const fieldReference = fields.find((field) => {
                return field.propertyName = reference.property.name;
            });

            if (reference.relationship === YamlDefinitionRelationship.ONE_TO_N) {
                return this.createMethodToSelectOneToN(languageDefinition, databaseLanguageDefinition, className);
            } else if (reference.relationship == YamlDefinitionRelationship.N_TO_ONE) {
                return this.createMethodToSelectNToOne(languageDefinition, databaseLanguageDefinition, reference, className, fieldReference);
            }
        });

        var dups = {};
        return methods.filter(function(method) {
            var hash = method.valueOf();
            var isDup = dups[hash];
            dups[hash] = true;
            return !isDup;
        });
    }

    createMethodToSelectOneToN(languageDefinition, databaseLanguageDefinition, className) {
        const methodName = `selectAllIdsInList`;
        let sql = `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement}`;
        const returnInterrogation = `\t\t${languageDefinition.returnDeclaration(languageDefinition.stringDeclaration('?'))}`;
        const interrogations = languageDefinition.lambdaMethod('ids', 'map', '', returnInterrogation);
        const interrogationsJoined = languageDefinition.methodCall(interrogations, 'join', [languageDefinition.stringDeclaration(', ')]);
        const interrogationsVar = languageDefinition.variableDeclaration(
            languageDefinition.constKeyword, 
            new TypeDefinition(languageDefinition.stringKeyword),
            'interrogations',
            interrogationsJoined);
        sql += ` ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.inKeyword} (${languageDefinition.stringReplacement})`;
        sql = languageDefinition.stringDeclaration(sql);
        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`, 'interrogations']);

        const dbExecCall = languageDefinition.methodCall(languageDefinition.thisKeyword, 'select', [formatMethodCall, 'ids']);
        
        const returnCall = `\t\t${interrogationsVar}\n\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className)),
            [
                this.databaseObject,
                new ParameterDefinition('ids', new TypeDefinition(languageDefinition.arrayKeyword, false, new TypeDefinition(languageDefinition.stringKeyword))),
            ],
            returnCall,
            languageDefinition.publicKeyword);
    }

    createMethodToSelectNToOne(languageDefinition, databaseLanguageDefinition, reference, className, fieldReference) {
        const methodName = `selectBy${reference.definition.name}Id`;
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement}`
        );
        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = languageDefinition.methodCall(languageDefinition.thisKeyword, 'select', [formatMethodCall, languageDefinition.nullKeyword]);
        
        const returnCall = `\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className)),
            [
                this.databaseObject,
                new ParameterDefinition(fieldReference.propertyName, new TypeDefinition(languageDefinition.stringKeyword)),
            ],
            returnCall,
            languageDefinition.publicKeyword);
    }
}

class DatabaseFieldHelper {
    constructor(databaseLanguageDefinition, languageDefinition, propertyName, type, required, fromClass = null) {
        this.fieldSufix = '_FIELD';

        this.type = type;

        this.propertyName = propertyName;
        let splittedName = StringUtils.splitNameWithUnderlines(this.propertyName);
        this.fieldName = `${splittedName.toUpperCase()}${this.fieldSufix}`;
        this.searchById = false;
        this.searchByDependencyId = false;
        this.isArrayOfString = false;

        if (this.type.subtype && !this.type.subtype.isNative) { // Is an array of other model
            this.searchById = true;
            this.searchByDependencyId = false;
            this.fieldName = 'ID_FIELD';
            this.databaseFieldName = null;
        } else if (!this.type.subtype && !this.type.isNative && !fromClass) { // Is not an array
            this.searchById = false;
            this.searchByDependencyId = true;
            splittedName = `${splittedName}_ID`;
            this.fieldName = `${splittedName.toUpperCase()}${this.fieldSufix}`;
            this.databaseType = new DatabaseTypeDefinition(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else if (this.type.subtype && DatabaseFieldHelper.isArrayOfString(languageDefinition, this.type)) {
            this.isArrayOfString = true;
            this.databaseType = new DatabaseTypeDefinition(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else {
            if (fromClass) {
                this.fromClass = fromClass;
            }
            this.databaseType = new DatabaseTypeDefinition(this.type, languageDefinition, databaseLanguageDefinition);
        }

        this.databaseFieldName = splittedName.toLowerCase();
        this.required = required;
    }

    static isArrayOfString(languageDefinition, type) {
        return type.name.indexOf(languageDefinition.arrayKeyword) > - 1 && type.subtype.name === languageDefinition.stringKeyword;
    }

    toProperty(languageDefinition) {
        return new PropertyDefinition(this.fieldName, 
            new TypeDefinition(languageDefinition.stringKeyword, true),
            languageDefinition.stringDeclaration(this.databaseFieldName),
            this.required,
            true);
    }

    getDatabaseFieldProperties(databaseLanguageDefinition) {
        let properties = [];
        if (this.propertyName === 'id') {
            properties.push(databaseLanguageDefinition.notNullKeyword);
            properties.push(databaseLanguageDefinition.primaryKeyKeyword);
        } else if (this.required) {
            properties.push(databaseLanguageDefinition.notNullKeyword);
        }

        return properties.join(' ');
    }
}

class DatabaseTypeDefinition {
    constructor(type, languageDefinition, databaseLanguageDefinition) {
        if (type.isEnum) {
            this.name = databaseLanguageDefinition.stringKeyword;
        } else if (type.name === languageDefinition.stringKeyword) {
            this.name = databaseLanguageDefinition.stringKeyword;
        } else if (type.name === languageDefinition.numberKeyword) {
            this.name = databaseLanguageDefinition.numberKeyword;
        } else if (type.name === languageDefinition.intKeyword || type.name === languageDefinition.booleanKeyword) {
            this.name = databaseLanguageDefinition.integerKeyword;
        } else {
            this.name = null;
        }
    }

    print() {
        return this.name;
    }
}