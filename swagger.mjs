import swaggerAutogen from 'swagger-autogen';

const outputFile = './swagger_output.json'
const endpointsFiles = 
    [
        './src/index.ts'
    ]
    const doc = {
      host: 'localhost:5050',
        info: {
          version: '',            // by default: '1.0.0'
          title: '',              // by default: 'REST API'
          description: ''         // by default: ''
        },
        servers: [
          {
            url: '',              // by default: 'http://localhost:3000'
            description: ''       // by default: ''
          },
          // { ... }
        ],
        tags: [                   // by default: empty Array
          {
            name: '',             // Tag name
            description: ''       // Tag description
          },
          // { ... }
        ],
        components: {}            // by default: empty object
      };
swaggerAutogen(outputFile, endpointsFiles, doc)