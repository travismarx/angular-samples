import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  Renderer2,
  ViewChild
} from "@angular/core";
import { Http } from "@angular/http";
import { ActivatedRoute } from "@angular/router";
import { SeatmapsService } from "../seatmaps.service";
import { ApiService } from "@services";
import * as _ from "lodash";
import { NotificationsService } from "angular2-notifications/dist";
import { SeatInfoPopoverComponent } from "../seat-info-popover";
import { SeatAssignmentsFormComponent } from "../seat-assignments-form";

@Component({
  selector: "full-seatmap",
  styleUrls: ["./full-seatmap.component.scss"],
  templateUrl: "./full-seatmap.component.html"
})
export class FullSeatmapComponent implements OnInit {
  @Output()
  newSeats: EventEmitter<any> = new EventEmitter();

  @Input()
  mapImage;
  @Input()
  seatmapData;
  @Input()
  sections;
  @Input()
  mapData;

  // @ViewChild("seatmapCanvas") canvasRef: ElementRef;
  @ViewChild("mapSVG")
  mapSVG: ElementRef;
  @ViewChild("seatInfo")
  seatInfo: ElementRef;
  @ViewChild("seatmapWrapper")
  seatmapWrapper: ElementRef;
  @ViewChild("seatmapSidebar")
  seatmapSidebar: ElementRef;
  @ViewChild(SeatInfoPopoverComponent)
  private seatInfoComponent: SeatInfoPopoverComponent;

  public hoverCoords: any;
  public useHeight: number;
  public infoDetailsVisible = false;
  public assignBtnLabel = "Create & Assign Seats";
  public assignBtnIcon = "fa-pencil";
  public assignmentDetails = {};

  public imageError = false;
  public seatDetails: any = { section: null, seat: null };
  public seatAssignVisible = false;
  public selectedSeatsArr: any[];
  public showCancelSelectOption = false;
  public seatAssignmentStep = 0;
  public unselectedSeatOptions: any[] = [];
  public showSeatDetails = true;
  // public showSeatEditor = false;
  public originalSeatDetails;

  private instructionText;
  private seatmap;
  private selectingSeats;
  private trueSeatElements;
  private trueSVG;
  private unselectedSeatsSelected: any[];

  private haveSeatmap = false;
  private hoveringAssignedSeat = false;
  private mapActions: any[] = [{ label: "Start select seats" }];
  private scaleVal = 0.2;
  private sectionOptions: any[] = [];

  constructor(
    private api: ApiService,
    private element: ElementRef,
    private http: Http,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private service: SeatmapsService,
    private notifService: NotificationsService
  ) {
    this.service.seatItemCoords$.subscribe(data => {
      this.handleSidebarSeatEvent(data);
    });
    this.service.assignSeatsSection$.subscribe(data => {
      this.handleAssignmentBtnClick();
    });
  }

  ngAfterViewInit() {}

  ngOnInit() {
    this.route.params.subscribe(data => {
      this.seatmapData.id = data["id"];
      if (this.sections.length) {
        const sections = this.sections;
        sections.map(sec => {
          this.sectionOptions.push({ label: sec.label, value: sec });
          // sec.value = sec.label;
        });
      }
    });

    const sidebarHeight = document.getElementById("seatmapSidebar").offsetHeight;
    this.selectedSeatsArr = [];
    this.useHeight = window.innerHeight - 200;
    this.seatmapWrapper.nativeElement.style.height = `${sidebarHeight - 140}px`;

    this.http
      .get(this.mapImage)
      .toPromise()
      .then(res => {
        this.seatmap = res.text();
        this.mapSVG.nativeElement.innerHTML = this.seatmap;
        const theSVG = this.mapSVG.nativeElement.getElementsByTagName("svg")[0];
        this.trueSVG = theSVG;
        this.renderer.setStyle(this.trueSVG, "margin", "0 auto");
        this.renderer.setStyle(this.trueSVG, "display", "block");
        this.renderer.addClass(this.trueSVG, "scale-watch");

        theSVG.width.baseVal.value = theSVG.width.baseVal.value / 2;
        theSVG.height.baseVal.value = theSVG.height.baseVal.value / 2;

        const allElements = this.trueSVG.getElementsByTagName("*");

        const elsByFill = this.service.filterElsByFill(allElements);
        const elSizes = [];
        const elsByHeight = {};
        elsByFill[0].map(el => {
          const rect = el.getBoundingClientRect();

          if (!elsByHeight[rect.height]) {
            elsByHeight[rect.height] = [];
          }
          elsByHeight[rect.height].push(el);
        });

        const byHeightArray = [];
        for (let i in elsByHeight) {
          if (elsByHeight[i]) {
            byHeightArray.push(elsByHeight[i]);
          }
        }
        byHeightArray.sort((a, b) => b.length - a.length);
        const mostFrequentHeight = byHeightArray[0][0].getBoundingClientRect().height;
        const frequentHeight2 = byHeightArray[1][0].getBoundingClientRect().height;
        const maxHeight = Number(mostFrequentHeight + mostFrequentHeight * 1.5);
        const minHeight = Number(mostFrequentHeight - mostFrequentHeight * 0.3);
        const maxHeight2 = Number(frequentHeight2 + frequentHeight2 * 1.5);
        const minHeight2 = Number(frequentHeight2 - frequentHeight2 * 0.3);
        let actualSeatsArr = [];

        for (let i in elsByHeight) {
          if (Number(i) > minHeight && Number(i) < maxHeight) {
            actualSeatsArr = actualSeatsArr.concat(elsByHeight[i]);
          } else if (Number(i) > minHeight2 && Number(i) < maxHeight2) {
            actualSeatsArr = actualSeatsArr.concat(elsByHeight[i]);
          }
        }

        // for (let i = 0; i < actualSeatsArr.length; i++) {
        //   const el = actualSeatsArr[i];
        //   el.style.fill = "#A1D490";
        // }
        this.trueSeatElements = actualSeatsArr;

        this.highlightAssignedSeats(); // Waiting on this until later
      })
      .catch(err => {
        console.log(err, "error on image request");
        // this.imageError = true;
      });
  }

  // Was using to highlight seat elements per section, just doing single color for time being
  highlightAssignedSeats() {
    const renderer = this.renderer;
    const len = this.sections.length;
    const elsCount = this.trueSeatElements.length;

    this.sections.map(sec => {
      sec.seats.map(seat => {
        if (seat.mapCoords.x && seat.mapCoords.y) {
          for (let i = 0; i < elsCount; i++) {
            const s = this.trueSeatElements[i];
            const seatEl = s.attributes;

            if (seatEl.cx) {
              if (seatEl.cx.value == seat.mapCoords.x && seatEl.cy.value == seat.mapCoords.y) {
                renderer.setStyle(s, "fill", "#0088cc");
                const parent = renderer.parentNode(s);
                const parent2 = renderer.parentNode(parent);
                const seatData = {
                  parent: parent2,
                  seat: seat,
                  section: sec.label
                };

                renderer.listen(
                  parent2,
                  "mouseenter",
                  this.assignedSeatHoverHandler.bind(null, seatData)
                );
                renderer.listen(parent2, "mouseleave", this.assignedSeatMouseLeave);
                if (!this.seatDetails.section) {
                  this.seatDetails = {
                    section: sec,
                    seat: seat
                  };
                }
              }
            }
          }
        }
      });
    });
  }

  assignedSeatHoverHandler = ({ parent, seat, section }): void => {
    if (!this.seatAssignmentStep) {
      this.infoDetailsVisible = true;
      this.hoveringAssignedSeat = true;

      setTimeout(() => {
        const seatInfo = this.seatInfoComponent;
        const renderer = this.renderer;
        this.seatInfoComponent.hoverDetails = { parent, seat, section };
      }, 150);
    }
  };

  assignedSeatMouseLeave = e => {
    this.hoveringAssignedSeat = false;
    if (this.seatAssignmentStep < 1) {
      const seatInfo = this.seatInfo.nativeElement;
      const renderer = this.renderer;

      setTimeout(() => {
        if (!this.hoveringAssignedSeat) {
          this.hoveringAssignedSeat = false;
          if (this.seatInfoComponent) {
            this.seatInfoComponent.hidePopover();
          }
        }
      }, 1000);
    }
  };

  handleSidebarSeatEvent({ seat, section, event }): void {
    if (!this.trueSeatElements) return;
    let seatEls = this.trueSeatElements;
    let coords = seat.mapCoords;

    for (let i = 0, len = seatEls.length; i < len; i++) {
      let seat = seatEls[i];
      let seatAttrs = seat.attributes;

      if (seatAttrs.cx) {
        if (seatAttrs.cx.value == coords.x && seatAttrs.cy.value == coords.y) {
          switch (event) {
            case "hasCoords":
              seat.style.fill = "#0088cc";
              break;

            case "mouseenter":
              seat.style.fill = "#00ff08";
              this.hoverCoords = coords;
              break;

            case "mouseleave":
              seat.style.fill = "#0088cc";
              this.hoverCoords = null;
              break;

            case "hide":
              seat.style.fill = "";
              break;
          }
          return;
        }
      }
    }
  }

  showSeatAssignDialog(): void {
    this.seatAssignVisible = true;
    this.prepareSeatAssignments();
  }

  prepareSeatAssignments(): void {
    const newArray = _.uniqBy(this.selectedSeatsArr, obj => {
      return obj.getBoundingClientRect().top + obj.getBoundingClientRect().left;
    });
    this.selectedSeatsArr = newArray;
  }

  cancelSeatSelection(): void {
    this.seatAssignVisible = false;
    this.seatAssignmentStep = 1;
    this.handleAssignmentBtnClick();
    this.selectedSeatsArr = _.uniqBy(this.selectedSeatsArr, obj => {
      return obj.getBoundingClientRect().top + obj.getBoundingClientRect().left;
    });
    this.selectedSeatsArr.forEach(seat => {
      this.renderer.setStyle(seat, "fill", "");
    });
    this.selectedSeatsArr = [];
  }

  startSeatSelection() {
    let clickCount = 0;
    let seatElements = this.trueSeatElements;
    this.infoDetailsVisible = false;

    this.trueSVG.addEventListener("click", e => {
      setTimeout(() => {
        this.trueSVG.addEventListener("click", e => {
          this.seatAssignmentStep = 3;
          this.assignBtnIconLabel(3);
          this.trueSVG.removeEventListener("click");
          for (let i = 0; i < seatElements.length; i++) {
            seatElements[i].removeEventListener("mouseenter", this.seatSelectEvent, true);
          }
        });
      });

      this.seatAssignmentStep = 2;
      this.assignBtnIconLabel(2);
      for (let i = 0; i < seatElements.length; i++) {
        seatElements[i].addEventListener("mouseenter", this.seatSelectEvent, true);
      }
      this.trueSVG.removeEventListener("click");
      clickCount = 0;
      return;
    });
  }

  saveSelectedSeats(rowData) {
    const data = {
      seatMapId: this.seatmapData.id,
      section: this.assignmentDetails,
      seats: rowData
    };
    const isNewSection = this.assignmentDetails.hasOwnProperty("newSection");
    this.service.assignSeatsToMap(data, this.selectedSeatsArr, isNewSection).then(res => {
      if (!res.status) {
        this.newSeats.emit();
        this.seatAssignVisible = false;
        this.seatAssignmentStep = 0;
        this.selectedSeatsArr = [];
      }
    });
  }

  handleAssignmentBtnClick() {
    let assignmentStep = this.seatAssignmentStep;

    switch (assignmentStep) {
      case 0:
        this.seatAssignmentStep = 1;
        this.startSeatSelection();
        break;

      case 1:
        this.seatAssignmentStep = 0;
        break;

      case 2:
        this.seatAssignmentStep = 3;
        break;

      case 3:
        this.seatAssignmentStep = 0;
        this.showSeatAssignDialog();
        break;
    }

    this.assignBtnIconLabel(this.seatAssignmentStep);
  }

  seatSelectEvent = e => {
    // console.log(this.selectedSeatsArr, "seats array on seat hover");
    e.target.style.fill = "#0088cc";
    this.selectedSeatsArr.push(e.target);
  };

  handleZoomIn() {
    this.trueSVG.width.baseVal.value = this.trueSVG.width.baseVal.value * 1.1;
    this.trueSVG.height.baseVal.value = this.trueSVG.height.baseVal.value * 1.1;
    this.scaleVal = this.scaleVal * 1.1;
  }

  handleZoomOut() {
    this.trueSVG.width.baseVal.value = this.trueSVG.width.baseVal.value * 0.9;
    this.trueSVG.height.baseVal.value = this.trueSVG.height.baseVal.value * 0.9;
    this.scaleVal = this.scaleVal * 0.9;
  }

  assignBtnIconLabel(int) {
    switch (int) {
      case 0:
        this.assignBtnLabel = "Create & Assign Seats";
        this.assignBtnIcon = "fa-pencil";
        this.showCancelSelectOption = false;
        break;

      case 1:
        this.assignBtnLabel = "Cancel";
        this.assignBtnIcon = "fa-times";
        this.instructionText = "Click on the seatmap to select your starting point";
        break;

      case 2:
        this.instructionText = "Move your mouse over seats to select, and click to finish";
        break;

      case 3:
        this.assignBtnLabel = "Confirm Selection";
        this.assignBtnIcon = "fa-check";
        this.instructionText =
          "If your seat selection looks okay, click the Confirm Selection button";
        this.showCancelSelectOption = true;
        break;
    }
  }
}
