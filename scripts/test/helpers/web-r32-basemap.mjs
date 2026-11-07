// WEB-R3.2 shared real-pointer interaction with the secondary raster control.
// The button is intentionally absent from the map toolbar and collapsed by default.
export async function toggleSecondaryBasemap(page){
 await page.openPanel('filters');
 await page.call(function(){document.getElementById('map-secondary-tools').open=true;});
 await page.click('#basemap-toggle');
 await page.click('#drawer-close');
}
