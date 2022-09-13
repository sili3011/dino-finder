import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Loader } from '@googlemaps/js-api-loader';

import secrets from 'secrets.json';
import { GoogleMap } from '@angular/google-maps';
import { MarkerManager } from '@googlemaps/markermanager';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'dino-finder';
  loadedMap = false;
  lat = 48;
  long = 16;
  options: google.maps.MapOptions = {
    mapId: secrets.MAP_ID,
    backgroundColor: '#30303030',
  };

  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  private dinoInfos: Map<string, JSON> = new Map();
  private infoWindows: Map<string, google.maps.InfoWindow> = new Map();
  private manager!: MarkerManager;

  private DINOS_URL =
    'https://us-central1-dino-finder-362009.cloudfunctions.net/api/dinos';
  private DINO_INFO_URL = 'https://paleobiodb.org/data1.2/occs/single.json?id=';
  private digs!: any[];

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  public ngOnInit(): void {
    const ua = navigator.userAgent;

    if (
      !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
        ua
      )
    ) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.lat = position.coords.latitude;
        this.long = position.coords.longitude;
      });
    }

    this._loadMap();

    const cache = localStorage.getItem('digs');
    if (cache) {
      this.digs = JSON.parse(cache);
      setTimeout(() => this.initMarkers(), 500);
    } else {
      this.http.get(this.DINOS_URL).subscribe((resp: any) => {
        this.digs = resp;
        localStorage.setItem('digs', JSON.stringify(this.digs));
        this.initMarkers();
      });
    }
  }

  private initMarkers(): void {
    const markers = this.digs.map(
      (dino: any) =>
        new google.maps.Marker({
          position: new google.maps.LatLng(dino.lat, dino.lng),
          title: dino.oid.split(':')[1],
          clickable: true,
        })
    );

    markers.forEach((marker) => {
      window.google.maps.event.addListener(marker, 'click', () => {
        const id = marker.getTitle();
        if (id) {
          if (this.infoWindows.has(id)) {
            this.infoWindows.get(id)?.close();
            this.infoWindows.delete(id);
          } else {
            if (!this.dinoInfos.has(id)) {
              this.http.get(this.DINO_INFO_URL + id).subscribe((resp: any) => {
                this.dinoInfos.set(id, resp.records[0]);
                this._openInfoWindow(marker, resp.records[0]);
              });
            } else {
              this._openInfoWindow(marker, this.dinoInfos.get(id)!);
            }
          }
        }
      });
    });

    this.manager.addMarkers(markers, 5, 15);
    this.manager.refresh();
  }

  private _openInfoWindow(marker: google.maps.Marker, content: JSON): void {
    const id = marker.getTitle()!;
    const infoWinodw = new google.maps.InfoWindow({
      position: marker.getPosition(),
      content: JSON.stringify(content),
      pixelOffset: new google.maps.Size(0, -32),
    });
    infoWinodw.open(this.map.googleMap);
    this.infoWindows.set(id, infoWinodw);
  }

  private _loadMap(): void {
    const loader = new Loader({
      apiKey: secrets.GMAP_API_KEY,
      version: 'weekly',
    });

    loader.load().then(() => {
      this.loadedMap = true;
      this.cd.detectChanges();
      this.manager = new MarkerManager(this.map.googleMap!, {});
    });
  }
}
