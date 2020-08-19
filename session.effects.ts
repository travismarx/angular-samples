import { mergeMap, tap, map, catchError, withLatestFrom, delay, first } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Actions, Effect } from "@ngrx/effects";
import { Observable, of } from "rxjs";
import { Action, Store } from "@ngrx/store";
import { ApiService, SocketService } from "@services";
import * as sessionActions from "./session.actions";
import * as sessionStore from "./session.reducers";
import * as chatActions from "../chat/chat.actions";
import * as fromRoot from "../index";

@Injectable()
export class SessionEffects {
  constructor(
    private actions: Actions,
    private api: ApiService,
    private socket: SocketService,
    private router: Router,
    private store: Store<sessionStore.State>
  ) {}

  /**
   * @name sessionLogin
   * @description Side effect for login action
   */
  @Effect()
  sessionLogin: Observable<Action> = this.actions.ofType(sessionActions.LOGIN).pipe(
    map((action: sessionActions.SessionLogin) => action.payload),
    mergeMap((payload) => this.api.newRequest("POST", "/session", null, payload)),
    map((res) => {
      if (res.OK) {
        return new sessionActions.SessionLoginSuccess(res);
      } else {
        if (!res.OK && res.message === "verify") {
          return new sessionActions.RequireAccountVerification();
        }
      }
    })
  );

  @Effect()
  loginSuccess: Observable<Action> = this.actions.ofType(sessionActions.LOGIN_SUCCESS).pipe(
    map((action: sessionActions.SessionLoginSuccess) => action.payload),
    tap((payload) => {
      this.router.navigate(["/dashboard"]);
      return this.store.dispatch(new chatActions.AddChatRooms(payload.leagues));
    })
  );

  @Effect({ dispatch: false })
  sessionLogout: Observable<Action> = this.actions
    .ofType(sessionActions.LOGOUT)
    .pipe(tap(() => this.router.navigate([""])));

  @Effect()
  verifySession: Observable<Action> = this.actions.ofType(sessionActions.VERIFY_SESSION).pipe(
    map((action: sessionActions.VerifySession) => action.payload),
    mergeMap(() => this.api.newRequest("GET", "/session")),
    map((res) => {
      if (res.OK) {
        return new sessionActions.VerifySessionSuccess(res);
      } else {
        if (res.OK && res.message === "verify") {
          return new sessionActions.RequireAccountVerification();
        }
        return;
      }
    }),
    catchError((err) => of({ type: sessionActions.VERIFY_SESSION_FAILURE }))
  );

  @Effect({ dispatch: false })
  verifySessionSuccess: Observable<Action> = this.actions
    .ofType(sessionActions.VERIFY_SESSION_SUCCESS)
    .pipe(
      tap(() => {
        // this.socket.connect();
      })
    );

  @Effect({ dispatch: false })
  verifySessionFailure: Observable<Action> = this.actions
    .ofType(sessionActions.VERIFY_SESSION_FAILURE)
    .pipe(
      tap(() => {
        this.router.navigate([""]);
      })
    );

  @Effect({ dispatch: false })
  incDashboardViewCount: Observable<any> = this.actions
    .ofType(sessionActions.INC_DASHBOARD_VIEW_COUNT)
    .pipe(
      withLatestFrom(
        this.store.select(fromRoot.getDashboardViewCount),
        this.store.select(fromRoot.getUserChampionshipStatus)
      ),
      delay(1000),
      map(([, count, championshipStatus]) => {
        if (count >= 1 && !championshipStatus) {
          this.store.dispatch(new sessionActions.ShowSignupModal(true));
        }
      })
    );

  @Effect({ dispatch: false })
  showSignupModal: any = this.actions.ofType(sessionActions.SHOW_SIGNUP_MODAL).pipe(
    withLatestFrom(this.store.select(fromRoot.getUserId)),
    first(),
    tap(([, userId]) => {
      this.socket.emit("signup-modal-seen", { userId: userId });
    })
  );
}
