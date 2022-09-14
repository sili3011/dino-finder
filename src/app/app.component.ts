import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Loader } from '@googlemaps/js-api-loader';
import { GoogleMap } from '@angular/google-maps';
import { MarkerManager } from '@googlemaps/markermanager';
import secrets from 'secrets.json';

interface DinoInfo {
  cid: string;
  eag: number;
  idn: string;
  lag: number;
  oei: string;
  oid: string;
  rid: string;
  rnk: number;
  tid: string;
  tna: string;
}

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
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: 1,
      position: 9,
    },
    streetViewControl: false,
    zoomControlOptions: {
      position: 6,
    },
  };

  isMobile = false;
  showFilterPanel = true;

  allDinoTypes: string[] = [];

  @ViewChild(GoogleMap) map!: GoogleMap;
  @ViewChild('mapSearchField') searchField!: ElementRef;
  @ViewChild('searchControl') searchControl!: ElementRef;

  private dinoInfos: Map<string, DinoInfo> = new Map();
  private infoWindows: Map<string, google.maps.InfoWindow> = new Map();
  private manager!: MarkerManager;

  private DINOS_URL =
    'https://us-central1-dino-finder-362009.cloudfunctions.net/api/dinos';
  private DINO_INFO_URL = 'https://paleobiodb.org/data1.2/occs/single.json?id=';
  private WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/';
  private WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/html/';
  private digs!: any[];

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  public ngOnInit(): void {
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
        navigator.userAgent
      );

    if (!this.isMobile) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.lat = position.coords.latitude;
        this.long = position.coords.longitude;
      });
    }

    this._loadMap();

    const cache = localStorage.getItem('digs');
    let getData = true;
    if (cache) {
      const cachedData = JSON.parse(cache);
      const now = new Date().getTime();
      if (now - cachedData.birth < 1000 * 60 * 60 * 24) {
        getData = false;
        this.digs = cachedData.digs;
        setTimeout(() => this.initUI(), 500);
      }
    }
    if (getData) {
      this.http.get(this.DINOS_URL).subscribe((resp: any) => {
        this.digs = resp;
        localStorage.setItem(
          'digs',
          JSON.stringify({ birth: new Date().getTime(), digs: this.digs })
        );
        this.initUI();
      });
    }
  }

  private initUI(): void {
    const searchBox = new google.maps.places.SearchBox(
      this.searchField.nativeElement
    );
    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(
      this.searchControl.nativeElement
    );
    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (!places || places.length === 0) {
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      places.forEach((place) => {
        if (place.geometry!.viewport) {
          bounds.union(place.geometry!.viewport);
        } else {
          bounds.extend(place.geometry!.location!);
        }
      });
      this.map.fitBounds(bounds);
    });

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

  private _openInfoWindow(marker: google.maps.Marker, content: DinoInfo): void {
    const id = marker.getTitle()!;
    this.http
      .get(this.WIKIPEDIA_API_URL + content.tna.replace(' ', '_'), {
        responseType: 'text',
      })
      .subscribe({
        next: (resp: string) => {
          this.fillInfoWindow(resp, marker, id);
        },
        error: (error) => {
          this.http
            .get(this.WIKIPEDIA_API_URL + content.tna.split(' ')[0], {
              responseType: 'text',
            })
            .subscribe({
              next: (resp: string) => {
                this.fillInfoWindow(resp, marker, id);
              },
            });
        },
      });
  }

  private fillInfoWindow(
    content: string,
    marker: google.maps.Marker,
    id: string
  ): void {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    doc.body.querySelectorAll('a[href^="./"]').forEach((href) => {
      href.addEventListener('click', (event) => {
        event.preventDefault();
        window.open(
          this.WIKIPEDIA_URL + href.getAttribute('href')?.replace('./', ''),
          '_blank'
        );
      });
    });
    doc.body.classList.add('body-window');
    const infoWinodw = new google.maps.InfoWindow({
      position: marker.getPosition(),
      content: doc.body,
      pixelOffset: new google.maps.Size(0, -32),
    });
    infoWinodw.open(this.map.googleMap);
    this.infoWindows.set(id, infoWinodw);
  }

  private _loadMap(): void {
    const loader = new Loader({
      apiKey: secrets.GMAP_API_KEY,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      this.loadedMap = true;
      this.cd.detectChanges();
      this.manager = new MarkerManager(this.map.googleMap!, {});
    });
  }

  public toggleFilterPanel(): void {
    this.showFilterPanel = !this.showFilterPanel;
  }
}
