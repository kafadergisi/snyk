import * as YAML from 'js-yaml';
import { CustomError } from '../../../../../lib/errors';
import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
} from '../types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

export function assertHelmAndThrow(fileData: IacFileData) {
  const lines: string[] = fileData.fileContent.split(/\r\n|\r|\n/);

  lines.forEach((line) => {
    const isHelmFile = line.includes('{{') && line.includes('}}');
    if (isHelmFile) {
      throw new HelmFileNotSupportedError(fileData.filePath);
    }
  });
}

export function tryParsingKubernetesFile(
  fileData: IacFileData,
): IacFileParsed[] {
  let yamlDocuments;

  assertHelmAndThrow(fileData);
  try {
    yamlDocuments = YAML.safeLoadAll(fileData.fileContent);
  } catch (e) {
    throw new FailedToParseKubernetesYamlError(fileData.filePath);
  }

  return yamlDocuments.map((parsedYamlDocument, docId) => {
    if (
      REQUIRED_K8S_FIELDS.every((requiredField) =>
        parsedYamlDocument.hasOwnProperty(requiredField),
      )
    ) {
      return {
        ...fileData,
        jsonContent: parsedYamlDocument,
        engineType: EngineType.Kubernetes,
        docId,
      };
    } else {
      throw new MissingRequiredFieldsInKubernetesYamlError(fileData.filePath);
    }
  });
}

class FailedToParseKubernetesYamlError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse Kubernetes YAML file');
    this.code = IaCErrorCodes.FailedToParseKubernetesYamlError;
    this.userMessage = `We were unable to parse the YAML file "${filename}". Please ensure that it contains properly structured YAML`;
  }
}

export class HelmFileNotSupportedError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse Helm file');
    this.code = IaCErrorCodes.FailedToParseHelmError;
    this.userMessage = `We were unable to parse the YAML file "${filename}" as we currently do not support scanning of Helm files. More information can be found through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool`;
  }
}

export class MissingRequiredFieldsInKubernetesYamlError extends CustomError {
  constructor(filename: string) {
    super('Failed to detect Kubernetes file, missing required fields');
    this.code = IaCErrorCodes.MissingRequiredFieldsInKubernetesYamlError;
    this.userMessage = `We were unable to detect whether the YAML file "${filename}" is a valid Kubernetes file, it is missing the following fields: 'apiVersion', 'kind', 'metadata'`;
  }
}
