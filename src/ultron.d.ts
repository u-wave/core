declare module 'ultron' {
  /**
   * Ultron is high-intelligence robot. It gathers intelligence so it can start improving
   * upon his rudimentary design. It will learn from your EventEmitting patterns
   * and exterminate them.
   */
  class Ultron {
    // (events: EventEmitter): Ultron;
    constructor(events: EventEmitter);

    /**
     * Register a new EventListener for the given event.
     *
     * @param {String} event Name of the event.
     * @param {Functon} fn Callback function.
     * @param {Mixed} context The context of the function.
     * @returns {Ultron}
     * @api public
     */
    on(event: string, fn: (...args: any[]) => void, context?: any): this;

    /**
     * Add an EventListener that's only called once.
     *
     * @param {String} event Name of the event.
     * @param {Function} fn Callback function.
     * @param {Mixed} context The context of the function.
     * @returns {Ultron}
     * @api public
     */
    once(event: string, fn: (...args: any[]) => void, context?: any): this;

    /**
     * Remove the listeners we assigned for the given event.
     *
     * @returns {Ultron}
     * @api public
     */
    remove(): this;
    remove(name: string): this;
    remove(...names: string[]): this;
    /**
     * Destroy the Ultron instance, remove all listeners and release all references.
     *
     * @returns {Boolean}
     * @api public
     */
    destroy(): boolean;
  }

  export = Ultron;
}
