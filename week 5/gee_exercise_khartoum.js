// Define the new Area of Interest (AOI) for Khartoum
var aoi = ee.Geometry.Polygon([
  [
      [32.49934598377152, 15.510298479854654],
      [32.50398716711848, 15.483361349961328],
      [32.550733835538836, 15.490515774446791],
      [32.55239943011833, 15.518720602273746],
      [32.49934598377152, 15.510298479854654],
  ],
]);

/**
 * Image Collection Filtering.
 *
 * This code filters Sentinel-2 images to select those taken before the conflict in March 2023 and after the
 * conflict in March 2024 to minimise seasonal changes. This lets us compare the “pre-event” and “post-event” imagery.
*/
var preEventCollection = ee
  .ImageCollection("COPERNICUS/S2_SR")
  .filterDate("2023-03-01", "2023-03-31")
  .filterBounds(aoi)
  .mosaic();

var postEventCollection = ee
  .ImageCollection("COPERNICUS/S2_SR")
  .filterDate("2024-03-01", "2024-03-31")
  .filterBounds(aoi)
  .mosaic();


/**
 * Masking Clouds and Vegetation.
 *
 * We apply cloud and vegetation masking to remove parts of the images that might interfere with our analysis.
 * The masking function below uses Sentinel’s classification bands (SCL) and Normalized Difference Vegetation
 * Index (NDVI) to filter out cloud shadows and areas with vegetation, making it easier to focus on changes
 * to building structures in processed composites for homogeneity and dissimilarity analysis.
 *
 * @param {ee.Image} image The Sentinel-2 image to mask.
 * @return {ee.Image} The masked image.
 */
function maskS2cloudsVegetation(image) {
  var scl = image.select("SCL");
  var ndvi = image.normalizedDifference(["B8", "B4"]);
  var cloudShadowMask = scl.eq(4).or(scl.eq(5)).or(scl.eq(6));
  var vegetationMask = ndvi.lt(0.2);

  return image.updateMask(cloudShadowMask.and(vegetationMask)).divide(10000);
}


/**
 * GLCM Texture Analysis for Damage Detection.
 *
 * The functions calculateCombinedHomogeneity and calculateCombinedDissimilarity use texture analysis (GLCM)
 * to calculate homogeneity and dissimilarity for all the 10m bands in Sentinel-2 images (R,G,B,NIR).
 * These metrics help highlight changes that might indicate damage by detecting changes in surface uniformity.
 */

/**
 * Function to calculate combined homogeneity for all 10m resolution bands.
 *
 * @param {ee.Image} image The Sentinel-2 image to calculate homogeneity.
 * @return {ee.Image} The combined homogeneity image.
 */
function calculateCombinedHomogeneity(image) {
  var bands = ["B2", "B3", "B4", "B8"];
  var homogeneityImages = bands.map(function (band) {
      var quantizedImage = image.select([band]).multiply(64).toInt();
      var glcm = quantizedImage.glcmTexture({ size: 1, average: true });
      return glcm.select([band + "_idm"]);
  });

  return ee.Image.cat(homogeneityImages)
      .reduce(ee.Reducer.mean())
      .rename("combined_homogeneity");
}

/**
 * Function to calculate combined dissimilarity for all 10m resolution bands.
 *
 * @param {ee.Image} image The Sentinel-2 image to calculate dissimilarity.
 * @return {ee.Image} The combined dissimilarity image.
 */
function calculateCombinedDissimilarity(image) {
  var bands = ["B2", "B3", "B4", "B8"];
  var dissimilarityImages = bands.map(function (band) {
      var quantizedImage = image.select([band]).multiply(64).toInt();
      var glcm = quantizedImage.glcmTexture({ size: 1, average: true });
      return glcm.select([band + "_diss"]);
  });

  return ee.Image.cat(dissimilarityImages)
      .reduce(ee.Reducer.mean())
      .rename("combined_dissimilarity");
}


// Applying cloud and vegetation mask for homogeneity and dissimilarity calculation on mosaicked images
var preEventProcessed = maskS2cloudsVegetation(preEventCollection);
var postEventProcessed = maskS2cloudsVegetation(postEventCollection);


// Calculate combined homogeneity
var preEventCombinedHomogeneity = calculateCombinedHomogeneity(preEventProcessed);
var postEventCombinedHomogeneity = calculateCombinedHomogeneity(postEventProcessed);

var combinedHomogeneityDiff = preEventCombinedHomogeneity.subtract(postEventCombinedHomogeneity).abs();

// Calculate combined dissimilarity
var preEventCombinedDissimilarity = calculateCombinedDissimilarity(preEventProcessed);
var postEventCombinedDissimilarity = calculateCombinedDissimilarity(postEventProcessed);

var combinedDissimilarityDiff = preEventCombinedDissimilarity.subtract(postEventCombinedDissimilarity).abs();


// Visualization parameters for Sentinel-2 imagery
var visParams = { bands: ["B4", "B3", "B2"], min: 0, max: 8000 };

/**
 * Build visualization parameters for combined homogeneity and dissimilarity images.
 *
 * @param {number} max The maximum value for the visualization parameters.
 * @returns {Object} The visualization parameters with the given maximum value applied.
 */
function generateParamsWithMax (max) {
  return { min: 0, max: max, palette: ["blue", "white", "red"] }
}


// Center the map and visualize the mosaicked images, combined homogeneity, and dissimilarity differences
Map.centerObject(aoi, 15);

Map.addLayer(
  preEventCollection.clip(aoi),
  visParams,
  "Pre-Event Mosaic"
);

Map.addLayer(
  postEventCollection.clip(aoi),
  visParams,
  "Post-Event Mosaic"
)
;
Map.addLayer(
  combinedHomogeneityDiff.clip(aoi),
  generateParamsWithMax(0.27),
  "Combined Enhanced Homogeneity Difference"
);

Map.addLayer(
  combinedDissimilarityDiff.clip(aoi),
  generateParamsWithMax(0.85),
  "Combined Enhanced Dissimilarity Difference"
);


/**
 * Retrieve Google Open Building Footprints.
 *
 * We use Google Open Building footprints to identify and focus on buildings in
 * the area. The code loads the dataset within our AOI to give us a visual
 * reference for assessing visible damage to these structures. This code will
 * also print on the console the number of building footprints in the AOI.
 **/

// Load the Google Open Buildings dataset
var openBuildings = ee
  .FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons")
  .filterBounds(aoi);


// Add the building footprints layer to the map
Map.addLayer(
  openBuildings,
  {},
  "Google Open Buildings Footprints"
);


// Print the number of building footprints within the AOI
var buildingCount = openBuildings.size();
print("Number of building footprints in the AOI:", buildingCount);
