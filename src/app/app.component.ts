import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Loader } from '@googlemaps/js-api-loader';

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

  DINOS_URL =
    'https://us-central1-dino-finder-362009.cloudfunctions.net/api/dinos';

  private db!: any[];

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {
    if (this.db) {
      this._loadMap();
    } else {
      this.http.get(this.DINOS_URL).subscribe((resp: any) => {
        this.db = resp;
        this._loadMap();
      });
    }
  }

  public ngOnInit(): void {
    navigator.geolocation.getCurrentPosition((position) => {
      this.lat = position.coords.latitude;
      this.long = position.coords.longitude;
    });
  }

  private _loadMap(): void {
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
