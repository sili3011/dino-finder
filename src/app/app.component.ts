import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import dinos from 'dinos.json';
import { BoundsLiteral } from '@ng-maps/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'dino-finder';
  initilized = false;
  lat = 0;
  long = 0;

  shownLocations: any[] = [];

  private ALL_RECORDS_URL =
    'https://paleobiodb.org/data1.2/occs/list.json?all_records';

  private db = dinos.records;

  constructor(private http: HttpClient) {}

  public ngOnInit(): void {
    navigator.geolocation.getCurrentPosition((position) => {
      this.lat = position.coords.latitude;
      this.lat = position.coords.longitude;
      this.initilized = true;
    });
    // run node backend once a day to receive new data and distribute it to clients
    // this.http
    //   .get('https://paleobiodb.org/data1.2/occs/list.json?all_records')
    //   .subscribe((rec) => console.log(rec));
  }

  showMarkers($event: BoundsLiteral): void {
    this.shownLocations = this.db
      .filter(
        (dino) =>
          dino.lat > $event.south &&
          dino.lat < $event.north &&
          dino.lng > $event.west &&
          dino.lng < $event.east
      )
      .slice(0, 100);
  }
}
