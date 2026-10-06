import {sql} from 'drizzle-orm';
// Planned capacity = reported weight already removed + estimates for unvisited scheduled stops.
// A failed stop contributes neither an estimated future pickup nor recovered weight.
export function dailyLoad(cooperativeId:string,date:string,exclude:string[]){
 return sql`(
 (SELECT COALESCE(SUM(s.actual_weight),0) FROM stop_results s WHERE s.cooperative_id=${cooperativeId} AND s.date=${date})+
 (SELECT COALESCE(SUM(i.actual_weight),0) FROM collection_items i JOIN collections c ON c.id=i.collection_id WHERE c.cooperative_id=${cooperativeId} AND c.date=${date})+
 (SELECT COALESCE(SUM(w.quantity_kg),0) FROM waste_points w WHERE w.reserved_by=${cooperativeId} AND w.scheduled_date=${date} AND w.status='scheduled' AND w.id NOT IN (${sql.join(exclude.map(v=>sql`${v}`),sql`,`)}) AND NOT EXISTS(SELECT 1 FROM stop_results s JOIN routes r ON r.id=s.route_id WHERE s.waste_point_id=w.id AND r.status IN ('scheduled','in_progress')))
 )`;
}
