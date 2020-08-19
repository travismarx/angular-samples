import { catchError, switchMap, map, tap, debounceTime, withLatestFrom } from "rxjs/operators";
import { Injectable } from "@angular/core";

import { Action, Store } from "@ngrx/store";
import { Actions, Effect } from "@ngrx/effects";
import { Observable, of } from "rxjs";

import * as dashboardActions from "./dashboard.actions";
import * as fromDashboard from "./dashboard.reducer";

import { DashboardService } from "../dashboard.service";
import { ApiService } from "@fantasy-services/api.service";
import { SocketService } from "@fantasy-services/socket.service";

import * as fromRoot from "@fantasy-store/index";

@Injectable()
export class DashboardEffects {
  constructor(
    private actions: Actions,
    private api: ApiService,
    private socket: SocketService,
    private dashboardService: DashboardService,
    private store: Store<fromDashboard.DashboardState>
  ) {}

  @Effect()
  getDashboard = this.actions.ofType(dashboardActions.GET_DASHBOARD).pipe(
    switchMap(() => {
      return this.api.newRequest("GET", "/users/dashboard").pipe(
        map((res) => new dashboardActions.GetDashboardSuccess(res)),
        catchError((err) => of(new dashboardActions.GetDashboardError(err)))
      );
    })
  );

  @Effect({ dispatch: false })
  getLiveData = this.actions.ofType(dashboardActions.GET_LIVE_DATA).pipe(
    withLatestFrom(
      this.store.select(fromRoot.getUserId),
      this.store.select(fromDashboard.getLiveTimingData),
      this.store.select(fromDashboard.getLiveUserTeam)
    ),
    debounceTime(1000),
    tap(([action, userId, liveData, team]) => {
      if (liveData && liveData.calculatePoints) {
        this.socket.emit("request-live-score", { userId: userId, eventId: liveData.eventId });
      }
      if (!team) {
        this.socket.emit("request-user-team", { userId: userId, eventId: liveData.eventId });
      }
    })
  );

  /**
   * @deprecated - Use websockets instead
   */
  // @Effect()
  // getLiveData = this.actions.ofType(dashboardActions.GET_LIVE_DATA).pipe(
  //   // .map((action: dashboardActions.GetLiveData) => action.payload)
  //   switchMap(() => {
  //     return this.api.newRequest("GET", "/users/dashboard/live_data").pipe(
  //       map(res => new dashboardActions.GetLiveDataSuccess(res)),
  //       catchError(err => {
  //         this.api.handleError(err);
  //         return of(new dashboardActions.GetLiveDataError(err.error));
  //       })
  //     );
  //   })
  // );

  @Effect()
  raceIsLiveChange$: Observable<Action> = this.dashboardService.raceIsLiveChange$.map((data) => {
    return new dashboardActions.RaceIsLiveChange(data);
  });

  @Effect()
  liveTimingData$: Observable<Action> = this.dashboardService.liveTimingData$.map((data) => {
    return new dashboardActions.LiveTimingData(data);
  });

  @Effect()
  liveScoreReceived$: Observable<Action> = this.dashboardService.liveScoreReceived$.map((data) => {
    return new dashboardActions.LiveScoreReceived(data);
  });

  @Effect()
  currentUserTeam$: Observable<Action> = this.dashboardService.currentUserTeam$.map((data) => {
    return new dashboardActions.UserTeamReceived(data);
  });
}
