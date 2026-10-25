# Local TypeScript configuration schema

`tsconfig.schema.json` is vendored from [SchemaStore](https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/tsconfig.json). The upstream license is included in `LICENSE.txt`.

All JSON references inside this schema are local fragments. Project tsconfig files reference this local copy explicitly, so VS Code can validate them without resolving schemastore.org. Schema validation remains enabled.
