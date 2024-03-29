import { readFileSync, writeFile, WriteFileOptions, existsSync } from "fs";
const csv = require("csvtojson");

const DEFAULT_FILE_ENCODING = "utf8";

type GroupByOptions = { groupByKey: string; groupedArrayProperty: string };

type MultCsvMergeToJsonOptions = {
  inputDir: string;
  inputKeys: Array<string>;
  inputFileNameList: Array<string>;
  outputDir: string;
  outputFileName: string;
  columnDelimiter: string;
  encoding?: WriteFileOptions;
  groupBy?: GroupByOptions;
  writeToFile?: boolean;
  replaceValues?: boolean;
};

function writeOutputFile(
  options: MultCsvMergeToJsonOptions,
  jsonObj: Array<Object> | Object
) {
  const dataBuffer = Buffer.from(JSON.stringify(jsonObj));
  const destFile = `${options.outputDir}/${options.outputFileName}.json`;
  const encoding = options.encoding || DEFAULT_FILE_ENCODING;

  writeFile(destFile, dataBuffer, encoding, function (err) {
    if (err)
      return console.log(
        "multiple-csv-merge-to-json ERROR writing output file : ",
        err
      );
    console.log("multiple-csv-merge-to-json SUCCESS file written");
    console.log(
      "multiple-csv-merge-to-json SUCCESS lines written in file %s : %s",
      destFile,
      Object.keys(jsonObj).length
    );
  });
}

async function readExistingJsonDataArray(
  options: MultCsvMergeToJsonOptions
): Promise<Array<Object>> {
  try {
    const encoding = options.encoding || DEFAULT_FILE_ENCODING;

    const data = await readFileSync(
      `${options.outputDir}/${options.outputFileName}.json`,
      encoding
    );
    if (typeof data === "string") return JSON.parse(data) as Array<Object>;
  } catch (error) {
    console.log("multiple-csv-merge-to-json ERROR reading file : ", error);
    console.log(
      "multiple-csv-merge-to-json ERROR reading file, file is generated by mergeCsvFilesToJsonArray first ?  "
    );
  }
  return [];
}

async function generateArrayOfJSONfromCSV(
  options: MultCsvMergeToJsonOptions
): Promise<Array<Array<Object>>> {
  const filesNames: Array<string> = options.inputFileNameList;

  const filesToImport = filesNames.map(
    (fileName) => `${options.inputDir}/${fileName}`
  );

  let filesExist = true;

  for (const file of filesToImport) {
    const fileExists = await existsSync(file);
    if (!fileExists) {
      console.log("multiple-csv-merge-to-json ERROR file not found", file);
      filesExist = false;
      break;
    }
  }

  if (filesExist) {
    return Promise.all(
      filesToImport.map(async (file) => {
        console.log("multiple-csv-merge-to-json importing file :", file);

        return csv({ delimiter: options.columnDelimiter }).fromFile(file);
      })
    );
  }

  return Promise.reject(
    new Error("At least one file given in options does not exists.")
  );
}

function objectMatchesSearchKeys(
  objectKeys: Array<string>,
  dataObject: any,
  searchObject: any
) {
  for (const key of objectKeys) {
    if (
      new String(dataObject[key])
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") !==
      new String(searchObject[key])
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    )
      return false;
  }

  return true;
}

function mergeObjects(existingObject: any, newObject: any): any {
  let updatedObject = { ...existingObject };
  for (const key in newObject) {
    updatedObject[key] = new String(newObject[key])
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  return updatedObject;
}

function updateData(
  objectKeys: Array<string>,
  existingData: Array<any>,
  newData: Array<Object>,
  replaceValues: boolean | undefined
): Array<Object> {
  let updatedData = [...existingData];

  for (const data of newData) {
    const indexFound = existingData.findIndex((_existingData) =>
      objectMatchesSearchKeys(objectKeys, _existingData, data)
    );

    if (indexFound >= 0) {
      const mergedObject = mergeObjects(existingData[indexFound], data);
      if (!replaceValues || existingData[indexFound].updated) {
        updatedData.push(mergedObject);
      } else {
        existingData[indexFound] = {
          ...existingData[indexFound],
          updated: true,
        };
        updatedData[indexFound] = mergedObject;
      }
    } else {
      updatedData.push(data);
    }
  }

  return updatedData;
}

function aggregateData(dataList: Array<any>, groupByOptions: GroupByOptions) {
  let aggregatedArray: Array<Object> = [];
  const dataMap = new Map();

  for (const data of dataList) {
    const key = data[groupByOptions.groupByKey];
    const existingDataByKey = dataMap.get(key);
    const object = { ...data };
    delete object[groupByOptions.groupByKey];

    if (existingDataByKey) {
      existingDataByKey.push(object);
      dataMap.set(key, existingDataByKey);
    } else {
      dataMap.set(key, [object]);
    }
  }

  const mapKeys = dataMap.keys();
  let keyObject = mapKeys.next();
  //Convert map to Object
  const newArray = [];
  while (!keyObject.done) {
    const _key = keyObject.value;
    let _object = {
      [groupByOptions.groupByKey]: _key,
      [groupByOptions.groupedArrayProperty]: dataMap.get(_key),
    };

    aggregatedArray.push(_object);
    keyObject = mapKeys.next();
  }

  return aggregatedArray;
}

function groupByData(dataList: Array<any>, groupByKey: GroupByOptions) {
  let aggregatedArray: Array<Object> = [];

  aggregatedArray = aggregateData(dataList, groupByKey);

  return aggregatedArray;
}

async function mergeCsvFilesToJsonArray(options: MultCsvMergeToJsonOptions) {
  try {
    const filesDataImported = await generateArrayOfJSONfromCSV(options);
    console.log(
      "multiple-csv-merge-to-json number of files to import : ",
      filesDataImported.length
    );
    let outputData = [{}];

    if (filesDataImported.length > 0) {
      console.log("multiple-csv-merge-to-json reading file at index 0");
      outputData = filesDataImported[0];
      console.log(
        "multiple-csv-merge-to-json lines in buffer END ",
        outputData.length
      );
      filesDataImported.slice(1).forEach((fileData, index) => {
        console.log(
          "multiple-csv-merge-to-json reading file at index %s",
          index + 1
        );
        outputData = updateData(
          options.inputKeys,
          outputData,
          fileData,
          options.replaceValues
        );
        console.log(
          "multiple-csv-merge-to-json lines in buffer END ",
          outputData.length
        );
      });
    }

    let finalObject = outputData;
    if (options.groupBy) {
      finalObject = groupByData(outputData, options.groupBy);
    }
    if (options.writeToFile === true) {
      writeOutputFile(options, finalObject);
    }
    return finalObject;
  } catch (error) {
    console.log(
      "multiple-csv-merge-to-json ERROR mergeCsvFilesToJsonArray",
      error
    );
    throw error;
  }
}

async function getJsonArray(options: MultCsvMergeToJsonOptions) {
  return readExistingJsonDataArray(options);
}

export { MultCsvMergeToJsonOptions, mergeCsvFilesToJsonArray, getJsonArray, writeOutputFile };
