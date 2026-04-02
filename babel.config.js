module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Fix lỗi import.meta cho @xenova/transformers
          unstable_transformImportMeta: true,
        },
      ],
    ],
    // NativeWind v2 giữ nguyên plugin này
    plugins: ["nativewind/babel",'react-native-reanimated/plugin']
  };
};