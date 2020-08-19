import { Component, OnInit, ChangeDetectionStrategy, ViewChild } from "@angular/core";
import { Angulartics2 } from "angulartics2";
import { Router } from "@angular/router";

import { Store } from "@ngrx/store";
import { map, take } from "rxjs/operators";

import * as fromRoot from "@fantasy-store/index";
import * as sessionActions from "@fantasy-store/session/session.actions";
import * as layoutActions from "@fantasy-store/layout/layout.actions";

import * as fromDashboard from "./store/dashboard.reducer";

import { trigger, style, animate, transition } from "@angular/animations";

@Component({
  selector: "dashboard-component",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ transform: "translateX(100%)", opacity: 0 }),
        animate("500ms", style({ transform: "translateX(0)", opacity: 1 })),
      ]),
      transition(":leave", [
        style({ transform: "translateX(0)", opacity: 1 }),
        animate("500ms", style({ transform: "translateX(100%)", opacity: 0 })),
      ]),
    ]),
  ],
})
export class DashboardComponent implements OnInit {
  loading;
  dashboardData;
  showChat;
  schedule;
  userLeagues;
  selectedTab;
  dashboardLoaded;
  siteVariables;
  liveData;
  deadlineExpired;
  championshipMember;
  modalSeen;
  showSignupModal;
  dashboardError;

  embedDimensions: any;

  constructor(
    private store: Store<fromRoot.AppState>,
    private angulartics2: Angulartics2,
    private router: Router
  ) {
    // const screenWidth = window.screen.availWidth;
    // console.log(screenWidth, "screen width");
    // if (screenWidth > 640) {
    //   this.embedDimensions = {
    //     width: 640,
    //     height: 360
    //   };
    // } else {
    //   this.embedDimensions = {
    //     width: screenWidth - 20,
    //     height: ((screenWidth - 20) / 16) * 9
    //   };
    // }
  }

  ngOnInit() {
    const screenWidth = window.screen.availWidth;
    if (screenWidth > 640) {
      this.embedDimensions = {
        width: 640,
        height: 360,
      };
    } else {
      this.embedDimensions = {
        width: screenWidth - 20,
        height: ((screenWidth - 20) / 16) * 9,
      };
    }
    this.dashboardData = this.store.select(fromDashboard.getDashboardData);
    this.dashboardLoaded = this.store.select(fromDashboard.getDashboardLoaded);
    this.loading = this.store.select(fromDashboard.getDashboardLoading);
    this.showChat = this.store.select(fromRoot.showChat);
    this.liveData = this.store.select(fromDashboard.getLiveTimingData);
    this.userLeagues = this.store.select(fromRoot.getUserLeagues);
    this.selectedTab = this.store.select(fromRoot.getSelectedTab);
    this.siteVariables = this.store.select(fromDashboard.getSiteVariables);
    this.deadlineExpired = this.store.select(fromRoot.getDeadlineExpired);
    this.championshipMember = this.store.select(fromRoot.getUserChampionshipStatus);
    this.dashboardError = this.store.select(fromDashboard.getDashboardError);
    this.modalSeen = this.store.select(fromRoot.getSignupModalSeen).pipe(
      take(1),
      map((seen) => {
        if (!seen) {
          this.store.dispatch(new sessionActions.IncreaseDashboardViewCount());
        }
        return seen;
      })
    );
    this.showSignupModal = this.store.select(fromRoot.getShowSignupModal);
  }

  toggleChat() {
    this.store.dispatch(new layoutActions.ToggleChat());
  }

  selectTab(tab) {
    this.store.dispatch(new layoutActions.SetSelectedTab(tab));
  }

  logJoinClick(e) {
    this.angulartics2.eventTrack.next({
      action: "click",
      properties: {
        category: "Join Championship",
        label: "Dashboard Join Button",
      },
    });
  }

  closeSignupModal() {
    this.store.dispatch(new sessionActions.ShowSignupModal(false));
    this.angulartics2.eventTrack.next({
      action: "click",
      properties: {
        category: "Signup Modal Action",
        label: "No",
      },
    });
  }

  signupModalSuccess() {
    this.store.dispatch(new sessionActions.ShowSignupModal(false));
    this.angulartics2.eventTrack.next({
      action: "click",
      properties: {
        category: "Signup Modal Action",
        label: "Yes",
      },
    });
    this.router.navigate(["/championship/join"]);
  }
}
