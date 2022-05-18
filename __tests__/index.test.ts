import { getJsonArray, mergeCsvFilesToJsonArray } from "../src";

test("getJsonArray, no file found, expect empty array", async () => {
  const jsonData = await getJsonArray({
    inputDir: "./data_input_files",
    inputKeys: ["city", "region"],
    inputFileNameList: [
      "general_rates.csv",
      "premium_rates.csv",
      "danger_zones.csv",
    ],
    outputDir: "./data_output_json",
    outputFileName: "delivery_rates",
    columnDelimiter: ",",
  });
  expect(jsonData).toStrictEqual([]);
});

test("mergeCsvFilesToJsonArray, no file found, expect error thrown", async () => {
  await expect(
    mergeCsvFilesToJsonArray({
      inputDir: "./wrong_dir",
      inputKeys: ["city", "region"],
      inputFileNameList: [
        "general_rates.csv",
        "premium_rates.csv",
        "danger_zones.csv",
      ],
      outputDir: "./data_output_json",
      outputFileName: "delivery_rates",
      columnDelimiter: ",",
    }).catch((error) => {
      throw error;
    })
  ).rejects.toThrow("At least one file given in options does not exists.");
});
