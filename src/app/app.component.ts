import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Loader } from '@googlemaps/js-api-loader';

import dinos from 'dinos.json';
import secrets from 'secrets.json';
import { GoogleMap, MapInfoWindow } from '@angular/google-maps';
import { MarkerManager } from '@googlemaps/markermanager';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'dino-finder';
  loadedScript = false;
  lat = 0;
  long = 0;

  shownLocations: any[] = [];

  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  @ViewChild(MapInfoWindow, { static: false })
  info!: MapInfoWindow;

  private ALL_RECORDS_URL =
    'https://paleobiodb.org/data1.2/occs/list.json?all_records';
  // https://paleobiodb.org/data1.2/occs/list.json?datainfo&rowcount&base_name=Dinosauria&show=coords

  private db = dinos.records;

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  public ngOnInit(): void {
    navigator.geolocation.getCurrentPosition((position) => {
      this.lat = position.coords.latitude;
      this.long = position.coords.longitude;
    });

    const loader = new Loader({
      apiKey: secrets.GMAP_API_KEY,
      version: 'weekly',
    });

    loader.load().then(() => {
      this.loadedScript = true;
      this.cd.detectChanges();

      const markerManager = new MarkerManager(this.map.googleMap!, {
        borderPadding: 0,
        maxZoom: 10,
        shown: true,
        trackMarkers: true,
      });

      //markerManager.addMarker(new google.maps.Marker())

      markerManager.addMarkers(
        this.db.map(
          (dino) =>
            new google.maps.Marker({
              position: new google.maps.LatLng(dino.lat, dino.lng),
            })
        ),
        1,
        25
      );
    });

    // run node backend once a day to receive new data and distribute it to clients
    // this.http
    //   .get('https://paleobiodb.org/data1.2/occs/list.json?all_records')
    //   .subscribe((rec) => console.log(rec));
  }

  public infoContent = '';

  public openInfo(element: any, content: string): void {
    this.infoContent = content;
    this.info.open(element);
  }

  consolo() {
    console.log(this.map.googleMap!.get('zoom'));
  }
}
