import * as jsonSchemaValidator from "./json-schema-validator.mjs";
import * as expressionValidator from "./expression-validator.mjs";
import * as topologyValidator from "./topology-validator.mjs";
import * as geometryValidator from "./geometry-validator.mjs";
import * as policyGateValidator from "./policy-gate-validator.mjs";

export const validatorRegistry = {
  json_schema: jsonSchemaValidator,
  expression: expressionValidator,
  topology: topologyValidator,
  geometry: geometryValidator,
  policy_gate: policyGateValidator
};
