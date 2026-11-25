import { piece, iron, rivet } from './_kit';

export default piece(54, 38, (c) => { iron(c); rivet(c, 6, 6); rivet(c, 47, 6); rivet(c, 6, 31); rivet(c, 47, 31); });