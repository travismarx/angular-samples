import { of as observableOf, Observable, of } from "rxjs";

import {
  catchError,
  distinctUntilChanged,
  switchMap,
  concatMap,
  mergeMap,
  combineLatest,
  withLatestFrom,
  map,
  tap,
} from "rxjs/operators";
import { Injectable } from "@angular/core";
import { Actions, Effect } from "@ngrx/effects";
import { Action, Store } from "@ngrx/store";
import { ApiService, TeamService, SocketService } from "../../services";
import * as teamActions from "./team.actions";
import * as teamStore from "./team.reducers";
import * as fromRoot from "../../store";

@Injectable()
export class TeamEffects {
  constructor(
    private actions: Actions,
    private api: ApiService,
    private teamService: TeamService,
    private socket: SocketService,
    private store: Store<teamStore.State>
  ) {}

  @Effect()
  getTeam: Observable<Action> = this.actions.ofType(teamActions.GET_TEAM).pipe(
    switchMap(() =>
      this.api.newRequest("GET", "/users/team").pipe(
        map((res) => new teamActions.GetTeamSuccess(res)),
        catchError((err) => of(new teamActions.GetTeamError(err)))
      )
    )
  );

  /**
   *  Watch ADD_RIDER, if it's full and there are no errors, save the team
   */
  @Effect({ dispatch: false })
  addRider: Observable<Action> = this.actions.ofType(teamActions.ADD_RIDER).pipe(
    map((action: teamActions.AddRider) => action.payload),
    distinctUntilChanged(),
    withLatestFrom(this.store.select(fromRoot.selectedTeam), this.store.select(fromRoot.teamError)),
    switchMap(([, team, err]) => {
      if (!err) {
        if (team["riders250"].length === 4 && team["riders450"].length === 4) {
          this.store.dispatch(new teamActions.SaveTeam(team));
        }
      }
      this.store.dispatch(new teamActions.LogTeamChange({ action: "addRider", error: err }));
      return observableOf(team);
    })
  );

  @Effect({ dispatch: false })
  removeRider: Observable<Action> = this.actions.ofType(teamActions.REMOVE_RIDER).pipe(
    map((action: teamActions.RemoveRider) => action.payload),
    distinctUntilChanged(),
    tap(() => {
      return this.store.dispatch(
        new teamActions.LogTeamChange({ action: "removeRider", error: null })
      );
    })
  );

  /**
   *  Watch ADD_RIDER, if it's full and there are no errors, save the team
   */
  @Effect({ dispatch: false })
  addLapOneLeader: Observable<Action> = this.actions.ofType(teamActions.ADD_LAP_ONE_LEADER).pipe(
    map((action: teamActions.AddLapOneLeader) => action.payload),
    combineLatest(this.store.select(fromRoot.selectedTeam), this.store.select(fromRoot.teamError)),
    switchMap(([payload, team, err]) => {
      if (!err) {
        if (team["riders250"].length === 4 && team["riders450"].length === 4) {
          this.store.dispatch(new teamActions.SaveTeam(team));
        }
      }
      this.store.dispatch(new teamActions.LogTeamChange({ action: "addFFL", error: err }));
      return observableOf(team);
    })
  );

  @Effect({ dispatch: false })
  removeLapOneLeader: Observable<Action> = this.actions
    .ofType(teamActions.REMOVE_LAP_ONE_LEADER)
    .pipe(
      map((action: teamActions.RemoveLapOneLeader) => action.payload),
      combineLatest(
        this.store.select(fromRoot.selectedTeam),
        this.store.select(fromRoot.teamError)
      ),
      mergeMap(([payload, team, err]) => {
        if (!err) {
          if (team["riders250"].length === 4 && team["riders450"].length === 4) {
            this.store.dispatch(new teamActions.SaveTeam(team));
          }
        }
        this.store.dispatch(new teamActions.LogTeamChange({ action: "removeFFL", error: err }));
        return observableOf(team);
      })
    );

  @Effect()
  saveTeam: Observable<Action> = this.actions.ofType(teamActions.SAVE_TEAM).pipe(
    map((action: teamActions.SaveTeam) => action.payload),
    concatMap((payload) =>
      this.api.newRequest("POST", "/users/team", null, payload).pipe(
        map((res) => {
          // this.store.dispatch(new teamActions.LogSavedTeam(res));
          return new teamActions.SaveTeamSuccess(res);
        }),
        catchError((err) => {
          // this.store.dispatch(new teamActions.LogSavedTeam(err));
          return of(new teamActions.SaveTeamError(err));
        })
      )
    )
  );

  @Effect({ dispatch: false })
  logTeamChange: Observable<void> = this.actions.ofType(teamActions.LOG_TEAM_CHANGE).pipe(
    map((action: teamActions.LogTeamChange) => action.payload),
    withLatestFrom(
      this.store.select(fromRoot.getSessionState),
      this.store.select(fromRoot.selectedTeam)
    ),
    switchMap(([payload, session, team]) => {
      const obj = {
        ...payload,
        team: team,
        userId: session["id"],
      };
      delete obj["id"];
      this.socket.emit("log-team-change", obj);
      return observableOf(null);
      // return
    })
  );

  @Effect({ dispatch: false })
  logSavedTeam: Observable<void> = this.actions.ofType(teamActions.LOG_SAVED_TEAM).pipe(
    map((action: teamActions.LogSavedTeam) => action.payload),
    withLatestFrom(
      this.store.select(fromRoot.getSessionState),
      this.store.select(fromRoot.selectedTeam)
    ),
    switchMap(([payload, session, team]) => {
      const obj = {
        ...payload,
        team: team,
        userId: session["id"],
        token: session["token"],
        tokenExp: session["tokenExp"],
      };
      delete obj["id"];
      this.socket.emit("save-team-log", obj);
      return observableOf(null);
    })
  );

  @Effect({ dispatch: false })
  requestHandicapCsv: Observable<Action> = this.actions
    .ofType(teamActions.REQUEST_HANDICAP_CSV)
    .pipe(
      map((action: teamActions.RequestHandicapCsv) => action.payload),
      concatMap((payload) =>
        this.api.newRequest("GET", "/riders/csv", null, payload).pipe(
          map((res) => {
            this.teamService.downloadCsv(res);
            return res;
          }),
          catchError((err) => of(new teamActions.SaveTeamError(err)))
        )
      )
    );

  @Effect()
  getRiderOptions: Observable<Action> = this.actions.ofType(teamActions.GET_RIDER_OPTIONS).pipe(
    switchMap(() =>
      this.api.newRequest("GET", "/riders/picks").pipe(
        map((res) => new teamActions.GetRiderOptionsSuccess(res)),
        catchError((err) => of(new teamActions.GetRiderOptionsError(err)))
      )
    )
  );

  @Effect()
  expertPicksChanged$: Observable<Action> = this.teamService.expertPicksChange$.pipe(
    map((msg) => {
      return new teamActions.ExpertPicksChange(msg);
    })
  );
}
