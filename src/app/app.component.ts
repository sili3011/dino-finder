import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Loader } from '@googlemaps/js-api-loader';

import dinos from 'dinos.json';
import secrets from 'secrets.json';
import { GoogleMap, MapInfoWindow, MapMarker } from '@angular/google-maps';

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
  options: google.maps.MapOptions = {
    mapId: secrets.MAP_ID,
    backgroundColor: '#30303030',
  };

  shownLocations: any[] = [];

  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

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
      this.shownLocations = this.db.map((dino: any) => ({
        position: new google.maps.LatLng(dino.lat, dino.lng),
        content: dino.tna,
      }));
    });
  }

  public openInfo(marker: MapMarker, mapInfoWindow: MapInfoWindow): void {
    mapInfoWindow.open(marker);
  }
}
