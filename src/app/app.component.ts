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
import { FormControl } from '@angular/forms';

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

interface DinoType {
  tna: string;
  count: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'DinoDigs';
  loadedMap = false;
  loadedUI = false;
  loadedFilter = false;
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

  public includedDinos: string[] = [];
  public dinoSearchInputControl = new FormControl<string>('');

  public isMobile = false;
  public showFilterPanel = false;

  private digs: DinoInfo[] = [];
  private dinoTypes: DinoType[] = [];
  public filteredDinoTypes: DinoType[] = [];

  @ViewChild(GoogleMap) map!: GoogleMap;
  @ViewChild('mapSearchField') searchField!: ElementRef;
  @ViewChild('searchControl') searchControl!: ElementRef;

  private dinoInfos: Map<string, DinoInfo> = new Map();
  private infoWindows: Map<string, google.maps.InfoWindow> = new Map();
  private manager!: MarkerManager;

  private DIGS_URL =
    'https://us-central1-dino-finder-362009.cloudfunctions.net/api/digs';
  private DINO_INFO_URL = 'https://paleobiodb.org/data1.2/occs/single.json?id=';
  private WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/';
  private WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/html/';

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {
    this.dinoSearchInputControl.valueChanges.subscribe((valueChanges) => {
      valueChanges
        ? (this.filteredDinoTypes = this.dinoTypes.filter((dino) =>
            dino.tna.toLowerCase().includes(valueChanges.toLowerCase())
          ))
        : this.dinoTypes;
    });
  }

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
        this.filteredDinoTypes = this.dinoTypes = cachedData.dinoTypes;
        setTimeout(() => this.initUI(), 500);
      }
    }
    if (getData) {
      this.http.get(this.DIGS_URL).subscribe((resp: any) => {
        this.digs = resp;
        this.filteredDinoTypes = this.dinoTypes = [
          ...new Set(this.digs.map((dig) => dig.tna)),
        ]
          .sort()
          .map((tax) => ({
            tna: tax,
            count: this.digs.filter((dig) => dig.tna === tax).length,
          }));
        localStorage.setItem(
          'digs',
          JSON.stringify({
            birth: new Date().getTime(),
            digs: this.digs,
            dinoTypes: this.dinoTypes,
          })
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

    this.setMarkers();
    this.loadedUI = true;
  }

  private setMarkers(): void {
    this.manager.clearMarkers();

    const markers = this.digs
      .filter(
        (dig) =>
          this.includedDinos.length === 0 ||
          this.includedDinos.includes(dig.tna.replace(' ', '_'))
      )
      .map(
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

    this.manager.addMarkers(markers, 1, 19);
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

  public isDinoIncluded(dino: string): boolean {
    return this.includedDinos.includes(dino.replace(' ', '_'));
  }

  public includeExcludeDino(dino: string): void {
    if (this.isDinoIncluded(dino)) {
      this.includedDinos.splice(this.includedDinos.indexOf(dino));
    } else {
      this.includedDinos.push(dino.replace(' ', '_'));
    }
    this.setMarkers();
  }
}
