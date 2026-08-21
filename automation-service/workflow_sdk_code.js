import { workflow, node, trigger, placeholder, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

// 1. Define nodes

const receiveRequest = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: '01 - Receive Generate Request',
    parameters: {
      httpMethod: 'POST',
      path: 'generate-3d-prod',
      responseMode: 'responseNode',
      options: {}
    },
    position: [100, 300]
  }
});

const validateInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '02 - Validate Input',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const body = $input.item.json.body || {};
const prompt = body.prompt || '';
const style = body.style || 'optional';
const provider = body.provider || 'auto';

if (!prompt || typeof prompt !== 'string') {
  return {
    json: {
      isValid: false,
      error: { code: 'INPUT_INVALID', message: 'Prompt is required and must be a string.', retryable: false }
    }
  };
}

if (prompt.length < 3 || prompt.length > 2000) {
  return {
    json: {
      isValid: false,
      error: { code: 'INPUT_INVALID', message: 'Prompt must be between 3 and 2000 characters.', retryable: false }
    }
  };
}

const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
return {
  json: {
    isValid: true,
    jobId: jobId,
    status: 'RECEIVED',
    stage: 'INPUT_VALIDATION',
    attempt: 0,
    maxAttempts: 3,
    originalPrompt: prompt,
    refinedPrompt: null,
    imageUrl: null,
    isolatedImageUrl: null,
    threeDProvider: provider,
    threeDJobId: null,
    modelUrl: null,
    thumbnailUrl: null,
    error: null,
    createdAt: new Date().toISOString()
  }
};
`
    },
    position: [300, 300]
  }
});

const isInputValid = ifElse({
  version: 2.2,
  config: {
    name: '02b - Is Input Valid?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.isValid }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    },
    position: [500, 300]
  }
});

const respond400 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: '02c - Respond 400',
    parameters: {
      respondWith: 'json',
      responseCode: 400,
      responseBody: expr('{{ JSON.stringify({ jobId: $json.jobId || "unknown", status: "FAILED", stage: "INPUT_VALIDATION", attempt: 1, error: $json.error }) }}')
    },
    position: [500, 500]
  }
});

const saveJobState = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: {
    name: '04 - Save Initial Job',
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'insert',
      schema: expr('{{ "public" }}'),
      table: expr('{{ "jobs" }}'),
      columns: expr('{{ "job_id, status, stage, original_prompt, attempt, created_at" }}'),
      valuesToSend: {
        values: [
          { column: 'job_id', value: expr('{{ $json.jobId }}') },
          { column: 'status', value: expr('{{ $json.status }}') },
          { column: 'stage', value: expr('{{ $json.stage }}') },
          { column: 'original_prompt', value: expr('{{ $json.originalPrompt }}') },
          { column: 'attempt', value: expr('{{ $json.attempt }}') },
          { column: 'created_at', value: expr('{{ $json.createdAt }}') }
        ]
      }
    },
    credentials: {
      postgres: newCredential('Postgres Database')
    },
    position: [700, 300]
  }
});

const refinePrompt = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '05 - Prompt Engineer Agent',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: expr('Bearer {{ $env.OPENROUTER_API_KEY }}') }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "meta-llama/llama-3-8b-instruct:free", messages: [ { role: "system", content: "You are an expert 3D asset prompt engineer.\\n\\nYour task is to transform a user\'s high-level idea into a highly detailed image-generation prompt optimized for AI image-to-3D reconstruction.\\n\\nThe resulting image will later be converted into a 3D asset.\\n\\nOptimize for 3D reconstruction accuracy, geometric clarity, material visibility, silhouette readability and complete object visibility.\\n\\nRULES:\\n1. Generate exactly ONE primary subject.\\n2. The complete subject must be visible.\\n3. Never crop body parts or important geometry.\\n4. Place the subject near the center.\\n5. Prefer a three-quarter front view unless another view is essential.\\n6. Ensure both front and side geometry are understandable.\\n7. Use a clean neutral background.\\n8. Avoid complex environments.\\n9. Avoid multiple unrelated objects.\\n10. Avoid text, labels, watermarks, logos and UI elements.\\n11. Use soft studio lighting that reveals geometry.\\n12. Preserve visible material properties.\\n13. Ensure a strong readable silhouette.\\n14. Avoid extreme perspective distortion.\\n15. Avoid excessive depth of field.\\n16. Avoid motion blur.\\n17. Avoid smoke or effects that hide important geometry.\\n18. Keep accessories attached to the primary subject when appropriate.\\n19. If the user request is ambiguous, choose a reasonable interpretation.\\n20. Prioritize a clean production-ready asset reference over cinematic composition.\\n\\nReturn ONLY valid JSON.\\nUse this schema:\\n{\\n  \\\"asset_name\\\": \\\"string\\\",\\n  \\\"asset_type\\\": \\\"character | prop | vehicle | architecture | creature | other\\\",\\n  \\\"style\\\": \\\"string\\\",\\n  \\\"image_prompt\\\": \\\"string\\\",\\n  \\\"negative_constraints\\\": [\\\"string\\\"],\\n  \\\"camera\\\": { \\\"view\\\": \\\"string\\\", \\\"lens\\\": \\\"string\\\" },\\n  \\\"generation\\\": { \\\"background\\\": \\\"string\\\", \\\"lighting\\\": \\\"string\\\", \\\"composition\\\": \\\"string\\\" }\\n}" }, { role: "user", content: $json.originalPrompt } ], response_format: { type: "json_object" } }) }}'),
      options: {}
    },
    position: [900, 300]
  }
});

const parsePromptJson = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '06 - Parse Prompt JSON',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const responseBody = $input.item.json.choices && $input.item.json.choices[0] && $input.item.json.choices[0].message && $input.item.json.choices[0].message.content;

if (!responseBody) {
  return {
    json: {
      isValidJson: false,
      error: { code: 'PROMPT_AGENT_FAILED', message: 'OpenRouter did not return a completion response.', retryable: true }
    }
  };
}

try {
  const parsed = JSON.parse(responseBody.trim());
  if (!parsed.image_prompt) {
    return {
      json: {
        isValidJson: false,
        error: { code: 'PROMPT_JSON_INVALID', message: 'Missing image_prompt field in refined prompt JSON.', retryable: true }
      }
    };
  }
  return {
    json: {
      isValidJson: true,
      refinedPromptJson: parsed,
      image_prompt: parsed.image_prompt
    }
  };
} catch (e) {
  return {
    json: {
      isValidJson: false,
      error: { code: 'PROMPT_JSON_INVALID', message: 'Failed to parse prompt JSON: ' + e.message, retryable: true }
    }
  };
}
`
    },
    position: [1100, 300]
  }
});

const isPromptJsonValid = ifElse({
  version: 2.2,
  config: {
    name: '07 - Validate Prompt Schema',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.isValidJson }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    },
    position: [1300, 300]
  }
});

const setPromptJsonError = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Set Prompt JSON Error',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'err-code', name: 'error', value: { code: 'PROMPT_JSON_INVALID', message: 'Failed to refine prompt into valid JSON.' }, type: 'object' },
          { id: 'err-stage', name: 'stage', value: 'PROMPT_JSON_INVALID', type: 'string' }
        ]
      }
    },
    position: [1300, 500]
  }
});

const generateImage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '08 - Generate Image',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: expr('https://generativelanguage.googleapis.com/v1beta/models/{{ $env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image" }}:generateContent'),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'x-goog-api-key', value: expr('{{ $env.GEMINI_API_KEY }}') }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ contents: [ { parts: [ { text: $json.image_prompt } ] } ], generationConfig: { responseModalities: ["IMAGE"] } }) }}'),
      options: {}
    },
    position: [1500, 300]
  }
});

const decodeImage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '08b - Decode Image to Binary',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const candidate = $input.item.json.candidates && $input.item.json.candidates[0];
const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts.find(p => p.inlineData);
if (!part) {
  throw new Error('Gemini response did not contain image data: ' + JSON.stringify($input.item.json).slice(0, 500));
}
const b64 = part.inlineData.data;
const mime = part.inlineData.mimeType || 'image/png';
const buffer = Buffer.from(b64, 'base64');
const binary = await this.helpers.prepareBinaryData(buffer, 'raw_asset.png', mime);
return { json: { ...$input.item.json, hasImage: true }, binary: { data: binary } };
`
    },
    position: [1700, 300]
  }
});

const isolateSubject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '10 - Isolate Subject',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $env.ASSET_PROCESSOR_URL }}/isolate'),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'x-api-key', value: expr('{{ $env.SERVICE_API_KEY }}') }
        ]
      },
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'image_file', inputDataFieldName: 'data' }
        ]
      },
      options: {}
    },
    position: [1900, 300]
  }
});

const checkIsolateResult = ifElse({
  version: 2.2,
  config: {
    name: '11 - Validate Isolate Result',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.success }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    },
    position: [2100, 300]
  }
});

const setIsolateError = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Set Isolate Error',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'iso-err', name: 'error', value: { code: 'IMAGE_PROCESSING_FAILED', message: 'FastAPI service failed to isolate subject.' }, type: 'object' },
          { id: 'iso-stage', name: 'stage', value: 'IMAGE_PROCESSING_FAILED', type: 'string' }
        ]
      }
    },
    position: [2100, 500]
  }
});

const createMeshyJob = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '12a - Create Meshy Job',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.meshy.ai/openapi/v1/image-to-3d',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: expr('Bearer {{ $env.MESHY_API_KEY }}') }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ image_url: $json.imageUrl, enable_pbr: true, should_remesh: true, ai_model: "meshy-4" }) }}'),
      options: {}
    },
    position: [2300, 300]
  }
});

const normalizeCreateResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '12c - Normalize Create Response',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const input = $input.item.json;
const state = $('02 - Validate Input').item.json;
const providerJobId = input.result || input.jobId || input.id;

if (!providerJobId) {
  throw new Error('Failed to extract job ID from Meshy: ' + JSON.stringify(input));
}

return {
  json: {
    ...state,
    threeDJobId: providerJobId,
    threeDProvider: 'meshy',
    status: 'PROCESSING',
    stage: 'THREE_D_GENERATION'
  }
};
`
    },
    position: [2500, 300]
  }
});

const waitFor3d = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: '13 - Wait For 3D',
    parameters: {
      resume: expr('{{ "value" }}'),
      waitAmount: 15,
      waitUnit: 'seconds'
    },
    position: [2700, 300]
  }
});

const checkMeshyStatus = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '14a - Check Meshy Status',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr('https://api.meshy.ai/openapi/v1/image-to-3d/{{ $json.threeDJobId }}'),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('Bearer {{ $env.MESHY_API_KEY }}') }
        ]
      },
      options: {}
    },
    position: [2900, 300]
  }
});

const normalizeStatusResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '14c - Normalize Status Response',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const input = $input.item.json;
const state = $('12c - Normalize Create Response').item.json;

let status = input.status || 'PROCESSING';
let modelUrl = input.model_urls && input.model_urls.glb;
let thumbnailUrl = input.thumbnail_url;
let error = null;

if (status === 'FAILED') {
  error = input.task_error || 'Meshy task failed';
}

const elapsed = (Date.now() - new Date(state.createdAt).getTime()) / 1000;
const timeoutLimit = parseInt(process.env.THREE_D_TIMEOUT_SECONDS || '600', 10);

if (status === 'PROCESSING' && elapsed > timeoutLimit) {
  status = 'TIMEOUT';
  error = 'Three-D generation timed out after ' + timeoutLimit + ' seconds.';
}

return {
  json: {
    ...state,
    status: status,
    modelUrl: modelUrl,
    thumbnailUrl: thumbnailUrl,
    error: error ? { code: 'THREE_D_PROVIDER_FAILED', message: error, retryable: false } : null
  }
};
`
    },
    position: [3100, 300]
  }
});

const isJobProcessing = ifElse({
  version: 2.2,
  config: {
    name: '14d - Is Job Processing?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.status }}'),
            operator: { type: 'string', operation: 'equals' },
            rightValue: 'PROCESSING'
          }
        ],
        combinator: 'and'
      }
    },
    position: [3300, 300]
  }
});

const didJobSucceed = ifElse({
  version: 2.2,
  config: {
    name: '14e - Did Job Succeed?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.status }}'),
            operator: { type: 'string', operation: 'equals' },
            rightValue: 'SUCCEEDED'
          }
        ],
        combinator: 'and'
      }
    },
    position: [3500, 300]
  }
});

const downloadGlb = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '15 - Download GLB',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.modelUrl }}'),
      options: {
        response: {
          response: {
            responseFormat: 'file'
          }
        }
      }
    },
    position: [3700, 300]
  }
});

const validateGlb = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '16 - Validate GLB',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const binary = $input.item.binary && $input.item.binary.data;
if (!binary) {
  return {
    json: {
      isValidGlb: false,
      error: { code: 'INVALID_GLB', message: 'No binary data found in downloaded model.', retryable: false }
    }
  };
}

const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
if (!buffer || buffer.length === 0) {
  return {
    json: {
      isValidGlb: false,
      error: { code: 'INVALID_GLB', message: 'GLB file is empty.', retryable: false }
    }
  };
}

const maxSizeMB = parseInt(process.env.MAX_GLB_SIZE_MB || '50', 10);
if (buffer.length > maxSizeMB * 1024 * 1024) {
  return {
    json: {
      isValidGlb: false,
      error: { code: 'INVALID_GLB', message: 'GLB file size exceeds limit of ' + maxSizeMB + 'MB.', retryable: false }
    }
  };
}

const magic = buffer.readUInt32LE(0);
if (magic !== 0x46546C67) {
  return {
    json: {
      isValidGlb: false,
      error: { code: 'INVALID_GLB', message: 'Invalid GLB file signature.', retryable: false }
    }
  };
}

const version = buffer.readUInt32LE(4);
if (version !== 2) {
  return {
    json: {
      isValidGlb: false,
      error: { code: 'INVALID_GLB', message: 'Unsupported GLB version: ' + version, retryable: false }
    }
  };
}

return {
  json: {
    ...$('14c - Normalize Status Response').item.json,
    isValidGlb: true,
    fileSize: buffer.length
  },
  binary: $input.item.binary
};
`
    },
    position: [3900, 300]
  }
});

const isGlbValid = ifElse({
  version: 2.2,
  config: {
    name: '16b - Is GLB Valid?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.isValidGlb }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    },
    position: [4100, 300]
  }
});

const optimizeGlb = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: '17 - Optimize GLB',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $env.ASSET_PROCESSOR_URL }}/optimize'),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'x-api-key', value: expr('{{ $env.SERVICE_API_KEY }}') }
        ]
      },
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'model_file', inputDataFieldName: 'data' }
        ]
      },
      options: {
        response: {
          response: {
            responseFormat: 'file'
          }
        }
      }
    },
    position: [4300, 300]
  }
});

const uploadGlbToS3 = node({
  type: 'n8n-nodes-base.s3',
  version: 1,
  config: {
    name: '18 - Upload GLB to S3',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'file',
      operation: 'upload',
      bucketName: expr('{{ $env.ASSET_STORAGE_BUCKET }}'),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: {
        parentFolderKey: expr('models/{{ $json.jobId }}'),
        acl: 'publicRead'
      }
    },
    credentials: {
      s3: newCredential('S3 Credentials')
    },
    position: [4500, 300]
  }
});

const updateJobSuccess = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: '19 - Update Job Success',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const state = $('16 - Validate GLB').item.json;
const modelUrl = 'https://' + process.env.ASSET_STORAGE_ENDPOINT + '/' + process.env.ASSET_STORAGE_BUCKET + '/models/' + state.jobId + '/raw_asset.png';

return {
  json: {
    jobId: state.jobId,
    status: 'SUCCEEDED',
    asset: {
      id: state.jobId,
      name: state.refinedPromptJson ? state.refinedPromptJson.asset_name : 'asset',
      format: 'glb',
      modelUrl: modelUrl,
      thumbnailUrl: state.thumbnailUrl
    }
  }
};
`
    },
    position: [4700, 300]
  }
});

const respondSuccess = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: '20 - Return Response',
    parameters: {
      respondWith: 'json',
      responseCode: 200,
      responseBody: expr('{{ JSON.stringify($json) }}')
    },
    position: [4900, 300]
  }
});

const formatPipelineError = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Pipeline Error',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const input = $input.item.json;
const error = input.error || {};
const stage = input.stage || 'unknown';

return {
  json: {
    jobId: input.jobId || 'unknown',
    status: 'FAILED',
    stage: stage,
    attempt: (input.attempt || 0) + 1,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || input.message || 'Pipeline execution failed.',
      retryable: error.retryable !== undefined ? error.retryable : false
    }
  }
};
`
    },
    position: [2900, 800]
  }
});

const respondError = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 502 Error',
    parameters: {
      respondWith: 'json',
      responseCode: 502,
      responseBody: expr('{{ JSON.stringify($json) }}')
    },
    position: [3100, 800]
  }
});


// 2. Compose connections and build workflow

export default workflow('text-to-3d-prod', 'Production Text-to-3D Asset Pipeline')
  .add(receiveRequest)
  .to(validateInput)
  .to(isInputValid
    .onTrue(saveJobState
      .to(refinePrompt
        .to(parsePromptJson
          .to(isPromptJsonValid
            .onTrue(generateImage
              .to(decodeImage
                .to(isolateSubject
                  .to(checkIsolateResult
                    .onTrue(createMeshyJob
                      .to(normalizeCreateResponse
                        .to(waitFor3d
                          .to(checkMeshyStatus
                            .to(normalizeStatusResponse
                              .to(isJobProcessing
                                .onTrue(waitFor3d)
                                .onFalse(didJobSucceed
                                  .onTrue(downloadGlb
                                    .to(validateGlb
                                      .to(isGlbValid
                                        .onTrue(optimizeGlb
                                          .to(uploadGlbToS3
                                            .to(updateJobSuccess
                                              .to(respondSuccess)
                                            )
                                          )
                                        )
                                        .onFalse(formatPipelineError)
                                      )
                                    )
                                  )
                                  .onFalse(formatPipelineError)
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                    .onFalse(setIsolateError.to(formatPipelineError))
                  )
                )
              )
            )
            .onFalse(setPromptJsonError.to(formatPipelineError))
          )
        )
      )
    )
    .onFalse(respond400)
  )
  .add(formatPipelineError)
  .to(respondError);

// Wire Error Paths
refinePrompt.onError(formatPipelineError);
generateImage.onError(formatPipelineError);
isolateSubject.onError(formatPipelineError);
createMeshyJob.onError(formatPipelineError);
checkMeshyStatus.onError(formatPipelineError);
downloadGlb.onError(formatPipelineError);
uploadGlbToS3.onError(formatPipelineError);
