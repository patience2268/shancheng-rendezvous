/** Approximate art scale: a 1.5-unit traveller beside 2.65+ unit floors.
 * Buildings keep their envelope; floor counts are derived, never 1-unit rows. */
export function facadeLayout(height: number, width: number, depth: number) {
  const floors=Math.max(1,Math.floor(height/2.65)),storey=height/floors;
  return {floors,storey,columns:Math.max(1,Math.floor(width/1.8)),sideColumns:Math.max(1,Math.floor(depth/1.9)),windowHeight:1.05,windowWidth:.78,doorHeight:1.95};
}
