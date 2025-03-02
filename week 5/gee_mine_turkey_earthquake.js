/**
 * Exercise
 *
 * Now that you’ve explored the structural damage in Khartoum, let’s investigate other areas that have experienced urban damage.
 * Here are some suggestions: Gaza, Kharkiv, and Aleppo.
 *
 * 1. Start by typing into the search box in Earth engine the name of a new location – for example ‘Gaza’.
 * 2. You will need to adjust the AOI, to do that, replace the first variable in the script with `var aoi = geometry;`.
 *    Then, use the rectangle drawing tool on the top left side of the map view to define your own area of interest.
 * 3. Keep the AOI limited in size, as large areas may cause the footprints to fail to load.
 * 4. Once you have created the AOI you will need to change the dates of the imagery for the pre and post conflict or event.
 *    So if you are looking at North Gaza like in my example above, the damage occurred in 2024. So I have changed the dates to be:
 *    - Pre event = August 2023
 *    - Post event = August 2024
 * 5. Using the same format, adjust the imagery collections dates in the script (Pre and Post-event) based on the timeline of the
 *    damage events.
 *    **Please note**: depending on the selected dates, some seasonal changes may be detected in open land areas.
 *    For example, when I originally did this for Gaza I selected March 2023 and August 2024. But March 2023 was very cloudy.
 *    You can see the cloud in the images when you toggle the display on and off. If this is the case then experiment with different
 *    dates of imagery.
 *
 *    var preEventCollection = ee
 *      .ImageCollection("COPERNICUS/S2_SR")
 *      .filterDate("2023-03-01", "2023-03-31")
 *      .filterBounds(aoi)
 *      .mosaic();
 *
 *   var postEventCollection = ee
 *      .ImageCollection("COPERNICUS/S2_SR")
 *      .filterDate("2024-03-01", "2024-03-31")
 *      .filterBounds(aoi)
 *      .mosaic();
 */

// Define the new Area of Interest (AOI) for Kharkiv
var aoi = ee.Geometry.Polygon([
  [36.73109683531627, 37.17387384193251],
  [36.752511592091174, 37.17387384193251],
  [36.752511592091174, 37.18573863880196],
  [36.73109683531627, 37.18573863880196],
  [36.73109683531627, 37.17387384193251],
]);

/**
 * Image Collection Filtering.
 *
 * This code filters Sentinel-2 images to select those taken before the attacks began in Feb 2024 and afterwards
 * in Feb 2025. This lets us compare the "pre-event" and "post-event" imagery.
*/
var preEventCollection = ee
  .ImageCollection("COPERNICUS/S2_SR")
  .filterDate("2022-04-01", "2022-04-30")
  .filterBounds(aoi)
  .mosaic();

  var postEventCollection = ee
  .ImageCollection("COPERNICUS/S2_SR")
  .filterDate("2023-04-01", "2023-04-30")
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
Map.centerObject(aoi, 16);

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

// // Load the Google Open Buildings dataset
// var openBuildings = ee
//   .FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons")
//   .filterBounds(aoi);


// // Add the building footprints layer to the map
// Map.addLayer(
//   openBuildings,
//   {},
//   "Google Open Buildings Footprints"
// );


// // Print the number of building footprints within the AOI
// var buildingCount = openBuildings.size();
// print("Number of building footprints in the AOI:", buildingCount);
