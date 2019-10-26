import ClassDefinition from "./definitions/class-definition";

export default interface Parser {
    parse(): ClassDefinition;
}